import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { visit, SKIP } from "unist-util-visit";
import GithubSlugger from "github-slugger";
import { imageSize } from "image-size";
import type { Root as HastRoot, Element, ElementContent, Text } from "hast";
import { BASE_PATH } from "./site";
import { encodePath, urlize } from "./urlize";

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export interface CardData {
  url: string;
  title: string;
  summary: string;
  cover: string;
}

export interface RenderContext {
  /** Directory of the source file relative to content/post ("" for top level). */
  sourceDirRel: string;
  /** File name without extension — images live in a sibling folder of this name. */
  stem: string;
  /** Site-relative URL of the rendered page, with trailing slash. */
  postUrl: string;
  /** Resolve an Obsidian-style `[text](file.md)` link to a site-relative URL. */
  resolveDocHref?: (target: string) => string | null;
  /** Resolve a `{{< postLinkCard path="..." >}}` target. */
  resolveCard?: (cardPath: string) => CardData | null;
  /** Extra directories to look up relative image references in (e.g. content/about). */
  extraImageDirs?: string[];
}

export interface RenderResult {
  html: string;
  toc: TocItem[];
  hasMermaid: boolean;
}

const CONTENT_POST_ROOT = path.join(process.cwd(), "content", "post");

/* ---------------------------------------------------------------- helpers */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The single place where the GitHub Pages base path gets applied. */
function siteHref(p: string): string {
  return encodePath(`${BASE_PATH}${p}`);
}

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href);
}

/* --------------------------------------------------- Hugo shortcode layer */

const SHORTCODE_RE = /\{\{<\s*\/?\s*([A-Za-z][\w-]*)\s*(.*?)\s*>\}\}/g;

function parseShortcodeArgs(rest: string): { named: Record<string, string>; positional: string[] } {
  const named: Record<string, string> = {};
  const positional: string[] = [];
  const re = /([\w-]+)=(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    if (m[1] !== undefined) named[m[1]] = m[2] ?? m[3] ?? "";
    else positional.push(m[4] ?? m[5] ?? "");
  }
  return { named, positional };
}

function emitShortcode(name: string, rest: string, ctx: RenderContext): string | null {
  const { named, positional } = parseShortcodeArgs(rest);

  switch (name) {
    case "postLinkCard": {
      const target = named.path ?? positional[0] ?? "";
      const card = ctx.resolveCard?.(target) ?? null;
      if (!card) {
        return `<a class="post-link-card post-link-card--missing" href="${escapeHtml(target)}">${escapeHtml(target)}</a>`;
      }
      const cover =
        !named.cover || named.cover === "auto" ? card.cover : named.cover;
      const excerpt =
        card.summary.length > 120 ? `${card.summary.slice(0, 120)}…` : card.summary;
      return (
        `<a class="post-link-card" href="${escapeHtml(card.url)}">` +
        `<span class="plc-cover"><img src="${escapeHtml(cover)}" alt=""></span>` +
        `<span class="plc-body"><strong class="plc-title">${escapeHtml(card.title)}</strong>` +
        `<span class="plc-excerpt">${escapeHtml(excerpt)}</span></span>` +
        `<span class="plc-cta" aria-hidden="true">READ ▸</span></a>`
      );
    }
    case "youtube": {
      const id = named.id ?? positional[0];
      if (!id) return "";
      return (
        `<div class="video-embed video-embed--16x9"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}"` +
        ` title="YouTube video player" loading="lazy"` +
        ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"` +
        ` referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
      );
    }
    case "bilibili": {
      const id = named.id ?? positional[0];
      if (!id) return "";
      const page = named.page ?? positional[1] ?? "1";
      const idParam = /^bv/i.test(id) ? `bvid=${id}` : `aid=${id.replace(/^av/i, "")}`;
      return (
        `<div class="video-embed video-embed--4x3"><iframe` +
        ` src="https://player.bilibili.com/player.html?${escapeHtml(idParam)}&amp;page=${escapeHtml(page)}&amp;autoplay=0"` +
        ` title="Bilibili video player" loading="lazy" scrolling="no" allowfullscreen></iframe></div>`
      );
    }
    default:
      return null; // unknown shortcode: leave source text untouched
  }
}

/** Replace Hugo shortcodes with HTML, skipping fenced code blocks. */
function replaceShortcodes(src: string, ctx: RenderContext): string {
  let inFence = false;
  return src
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(SHORTCODE_RE, (match, name: string, rest: string) => {
        return emitShortcode(name, rest, ctx) ?? match;
      });
    })
    .join("\n");
}

/* ----------------------------------------------------- Obsidian callouts */

const CALLOUT_LABELS: Record<string, string> = {
  note: "筆記",
  info: "資訊",
  tip: "提示",
  hint: "提示",
  important: "重要",
  warning: "警告",
  caution: "注意",
  attention: "注意",
  danger: "危險",
  error: "錯誤",
  success: "成功",
  question: "問題",
  quote: "引用",
  example: "範例",
  abstract: "摘要",
  summary: "摘要",
  todo: "待辦",
  bug: "BUG",
};

/** Visual style group per callout type (drives icon + colour in CSS). */
const CALLOUT_STYLE: Record<string, string> = {
  note: "note",
  info: "info",
  abstract: "info",
  summary: "info",
  todo: "info",
  tip: "tip",
  hint: "tip",
  success: "tip",
  important: "important",
  question: "important",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  danger: "danger",
  error: "danger",
  bug: "danger",
  failure: "danger",
  quote: "quote",
  example: "quote",
};

const CALLOUT_MARKER_RE = /^\[!([A-Za-z]+)\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n|$)/;

function transformCallouts(tree: HastRoot): void {
  visit(tree, "element", (node: Element, index, parent) => {
    if (node.tagName !== "blockquote" || !parent || index === undefined) return;

    const firstP = node.children.find(
      (c): c is Element => c.type === "element" && c.tagName === "p",
    );
    if (!firstP) return;
    const firstText = firstP.children[0];
    if (!firstText || firstText.type !== "text") return;

    const m = firstText.value.match(CALLOUT_MARKER_RE);
    if (!m) return;

    const type = m[1].toLowerCase();
    const style = CALLOUT_STYLE[type] ?? "note";
    const label =
      m[3]?.trim() ||
      CALLOUT_LABELS[type] ||
      type.charAt(0).toUpperCase() + type.slice(1);

    // Strip the marker line from the first paragraph.
    (firstText as Text).value = firstText.value.slice(m[0].length);
    if (!firstText.value && firstP.children.length === 1) {
      node.children = node.children.filter((c) => c !== firstP);
    }

    const body: Element = {
      type: "element",
      tagName: "div",
      properties: { className: ["callout-body"] },
      children: node.children.filter(
        (c): c is ElementContent => !(c.type === "text" && !c.value.trim()),
      ),
    };

    parent.children[index] = {
      type: "element",
      tagName: "div",
      properties: { className: ["callout", `callout--${style}`] },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["callout-title"] },
          children: [
            {
              type: "element",
              tagName: "span",
              properties: { className: ["callout-icon"], ariaHidden: "true" },
              children: [],
            },
            { type: "text", value: label },
          ],
        },
        body,
      ],
    };
  });
}

/* ------------------------------------------------- headings + TOC + misc */

function textOf(node: Element): string {
  let out = "";
  visit(node, "text", (t: Text) => {
    out += t.value;
  });
  return out;
}

function transformHeadings(tree: HastRoot, toc: TocItem[]): void {
  const slugger = new GithubSlugger();
  visit(tree, "element", (node: Element) => {
    const m = node.tagName.match(/^h([1-6])$/);
    if (!m) return;
    let depth = Number(m[1]);
    // The page template renders the post title as the only <h1>; demote
    // body-level h1s so they join the document outline (and the TOC).
    if (depth === 1) {
      depth = 2;
      node.tagName = "h2";
    }
    const text = textOf(node).trim();
    if (!text) return;
    const id = slugger.slug(text);
    node.properties = { ...node.properties, id };
    if (depth >= 2 && depth <= 4) toc.push({ id, text, depth });
    node.children.push({
      type: "element",
      tagName: "a",
      properties: {
        className: ["heading-anchor"],
        href: `#${id}`,
        ariaLabel: text,
      },
      children: [{ type: "text", value: "#" }],
    });
  });
}

function transformMermaid(tree: HastRoot, flag: { hasMermaid: boolean }): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "pre") return;
    const code = node.children.find(
      (c): c is Element => c.type === "element" && c.tagName === "code",
    );
    if (!code) return;
    const cls = code.properties?.className;
    if (!Array.isArray(cls) || !cls.includes("language-mermaid")) return;
    flag.hasMermaid = true;
    node.properties = { className: ["mermaid"] };
    node.children = code.children;
  });
}

function wrapTables(tree: HastRoot): void {
  visit(tree, "element", (node: Element, index, parent) => {
    if (node.tagName !== "table" || !parent || index === undefined) return;
    if (parent.type === "element" && (parent as Element).tagName === "div") {
      const cls = (parent as Element).properties?.className;
      if (Array.isArray(cls) && cls.includes("table-wrap")) return;
    }
    parent.children[index] = {
      type: "element",
      tagName: "div",
      properties: { className: ["table-wrap"] },
      children: [node],
    };
    return SKIP;
  });
}

/* ------------------------------------------------------- links + images */

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Vault-wide index of non-markdown files under content/post, keyed by file
 * name — mirrors how Obsidian resolves `![](file-x.png)` when the image lives
 * in another note's folder (such references were broken on the old Hugo site).
 */
let imageIndex: Map<string, string> | null = null;
function getImageIndex(): Map<string, string> {
  if (imageIndex) return imageIndex;
  const index = new Map<string, string>();
  const walk = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "Template") continue;
      const full = path.join(dir, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, childRel);
      else if (!/\.md$/i.test(entry.name) && !index.has(entry.name)) {
        index.set(entry.name, childRel);
      }
    }
  };
  walk(CONTENT_POST_ROOT, "");
  imageIndex = index;
  return index;
}

/** Resolve an image reference to its public URL path + source file (if found). */
function resolveImageRef(
  src: string,
  ctx: RenderContext,
): { sitePath: string; file: string | null } {
  const decoded = decodeURIComponent(src);

  if (decoded.startsWith("/")) {
    for (const root of ["public", "static"]) {
      const c = path.join(process.cwd(), root, decoded);
      if (fileExists(c)) return { sitePath: decoded, file: c };
    }
    return { sitePath: decoded, file: null };
  }

  const localCandidates = [
    path.join(CONTENT_POST_ROOT, ctx.sourceDirRel, ctx.stem, decoded),
    path.join(CONTENT_POST_ROOT, ctx.sourceDirRel, decoded),
    ...(ctx.extraImageDirs ?? []).map((d) => path.join(d, decoded)),
  ];
  for (const c of localCandidates) {
    if (fileExists(c)) {
      return { sitePath: path.posix.normalize(`${ctx.postUrl}${decoded}`), file: c };
    }
  }

  // Obsidian-style fallback: unique file-name lookup across the whole vault.
  const hit = getImageIndex().get(path.posix.basename(decoded));
  if (hit) {
    const dir = path.posix.dirname(hit);
    const urlDir = dir === "." ? "" : `${dir.split("/").map(urlize).join("/")}/`;
    return {
      sitePath: `/post/${urlDir}${path.posix.basename(hit)}`,
      file: path.join(CONTENT_POST_ROOT, hit),
    };
  }

  return { sitePath: path.posix.normalize(`${ctx.postUrl}${decoded}`), file: null };
}

function transformLinksAndImages(tree: HastRoot, ctx: RenderContext): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName === "a") {
      const href = node.properties?.href;
      if (typeof href !== "string" || !href || href.startsWith("#")) return;

      if (isExternal(href)) {
        node.properties = {
          ...node.properties,
          target: "_blank",
          rel: "noopener noreferrer",
        };
        return;
      }

      // Obsidian-style markdown link: [text](some-note.md) or [t](dir/note.md#h)
      if (/\.md(#|$)/i.test(href)) {
        const resolved = ctx.resolveDocHref?.(href) ?? null;
        if (resolved) {
          node.properties = { ...node.properties, href: siteHref(resolved) };
          return;
        }
      }

      if (href.startsWith("/")) {
        // Site-absolute post links may use the original (uppercase/unslugged)
        // path — canonicalize through the post index like postLinkCard does.
        const [p, anchor] = href.split("#", 2);
        const suffix = anchor ? `#${anchor}` : "";
        if (/^\/post\//i.test(p)) {
          const target = ctx.resolveCard?.(p);
          if (target) {
            node.properties = { ...node.properties, href: siteHref(target.url) + suffix };
            return;
          }
        }
        node.properties = { ...node.properties, href: siteHref(decodeURIComponent(p)) + suffix };
      }
      return;
    }

    if (node.tagName === "img") {
      const src = node.properties?.src;
      if (typeof src !== "string" || !src) return;
      if (isExternal(src)) {
        node.properties = { ...node.properties, loading: "lazy", decoding: "async" };
        return;
      }

      const { sitePath, file } = resolveImageRef(src, ctx);
      const dims: { width?: number; height?: number } = {};
      if (file) {
        try {
          const size = imageSize(fs.readFileSync(file));
          if (size.width && size.height) {
            dims.width = size.width;
            dims.height = size.height;
          }
        } catch {
          /* unreadable image: skip dimensions */
        }
      }

      node.properties = {
        ...node.properties,
        src: siteHref(sitePath),
        loading: "lazy",
        decoding: "async",
        ...dims,
      };
    }
  });
}

/* ------------------------------------------------------------- pipeline */

export async function renderMarkdown(
  raw: string,
  ctx: RenderContext,
): Promise<RenderResult> {
  const toc: TocItem[] = [];
  const flag = { hasMermaid: false };
  const pre = replaceShortcodes(raw, ctx);

  const file = await unified()
    .use(remarkParse)
    // singleTilde:false matches Hugo's goldmark: only ~~text~~ is strikethrough.
    .use(remarkGfm, { singleTilde: false })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(() => (tree: HastRoot) => {
      transformCallouts(tree);
      transformMermaid(tree, flag);
      transformHeadings(tree, toc);
      transformLinksAndImages(tree, ctx);
      wrapTables(tree);
    })
    .use(rehypeStringify)
    .process(pre);

  return { html: String(file), toc, hasMermaid: flag.hasMermaid };
}
