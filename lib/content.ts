import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { COVER_POOL } from "./site";
import { urlize, urlizePath } from "./urlize";
import { renderMarkdown, type TocItem } from "./markdown";

const CONTENT_ROOT = path.join(process.cwd(), "content");
const POST_ROOT = path.join(CONTENT_ROOT, "post");
/** Folders under content/post that are not published (Obsidian vault internals). */
const EXCLUDED_DIRS = new Set(["Template"]);

export interface PostMeta {
  /** Hugo-compatible URL slug, e.g. "系統/ar卡篇/1星ar卡". */
  slug: string;
  /** Slug split into route segments. */
  segments: string[];
  /** Site-relative URL with trailing slash, e.g. "/post/系統/ar卡篇/1星ar卡/". */
  url: string;
  /** Source path relative to content/post, e.g. "系統/AR卡篇/1星AR卡.md". */
  sourceRel: string;
  /** Directory of the source file relative to content/post ("" for top level). */
  sourceDirRel: string;
  /** File name without extension (original casing). */
  stem: string;
  title: string;
  /** ISO date string. */
  date: string;
  /** ISO date string (falls back to date). */
  lastmod: string;
  summary: string;
  description: string;
  keywords: string;
  weight: number;
  categories: string[];
  tags: string[];
  /** Site-relative cover URL (explicit front matter cover or deterministic pick). */
  cover: string;
  hasExplicitCover: boolean;
  /** CJK-aware word count of the body. */
  wordCount: number;
}

export interface Post extends PostMeta {
  html: string;
  toc: TocItem[];
  hasMermaid: boolean;
}

export interface TaxonomyTerm {
  /** Display name as written in front matter (first occurrence wins). */
  name: string;
  /** Hugo-compatible URL slug. */
  slug: string;
  posts: PostMeta[];
}

interface RawDoc {
  meta: PostMeta;
  body: string;
}

// Content is read from disk at runtime (fs), not imported, so Next's Fast Refresh
// — which only watches the module graph — never reacts to edits under content/post/.
// Worse, these process-lived caches would serve stale Markdown until the dev server
// is restarted. So cache only in the production build; in dev re-read every request
// and a browser refresh shows the latest content.
const CONTENT_CACHE = process.env.NODE_ENV === "production";
let docsCache: RawDoc[] | null = null;
const renderCache = new Map<string, Post>();

function walkMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      if (entry.name === "_index.md") continue;
      out.push(full);
    }
  }
  return out;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
      .map((v) => String(v).trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

const CJK_RE =
  /[⺀-⻿　-〿぀-ヿ㇀-㇯㈀-鿿豈-﫿＀-￯]/g;

function countWords(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{\{<[^>]*>\}\}/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  const cjk = (text.match(CJK_RE) || []).length;
  const latinWords = (text.replace(CJK_RE, " ").match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + latinWords;
}

/** Deterministic cover pick so builds are reproducible (Hugo used a random pool). */
function pickCover(slug: string): string {
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) + hash + slug.charCodeAt(i)) >>> 0;
  }
  return COVER_POOL[hash % COVER_POOL.length];
}

function loadDocs(): RawDoc[] {
  if (docsCache && CONTENT_CACHE) return docsCache;
  const docs: RawDoc[] = [];

  for (const file of walkMarkdownFiles(POST_ROOT)) {
    const sourceRel = path.relative(POST_ROOT, file).split(path.sep).join("/");
    const raw = fs.readFileSync(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft === true) continue;

    const stem = path.basename(sourceRel, ".md");
    const sourceDirRel = path.posix.dirname(sourceRel) === "." ? "" : path.posix.dirname(sourceRel);
    const slug = urlizePath(sourceDirRel ? `${sourceDirRel}/${stem}` : stem);
    const segments = slug.split("/");
    const url = `/post/${slug}/`;

    const date = toIsoDate(data.date);
    const explicitCover = typeof data.cover === "string" && data.cover.trim() ? data.cover.trim() : "";
    const wordCount = countWords(content);

    docs.push({
      meta: {
        slug,
        segments,
        url,
        sourceRel,
        sourceDirRel,
        stem,
        title: typeof data.title === "string" && data.title ? data.title : stem,
        date,
        lastmod: toIsoDate(data.lastmod) || date,
        summary: typeof data.summary === "string" ? data.summary.trim() : "",
        description: typeof data.description === "string" ? data.description.trim() : "",
        keywords: typeof data.keywords === "string" ? data.keywords : "",
        weight: typeof data.weight === "number" ? data.weight : 0,
        categories: toStringArray(data.categories),
        tags: toStringArray(data.tags),
        cover: explicitCover || pickCover(slug),
        hasExplicitCover: Boolean(explicitCover),
        wordCount,
      },
      body: content,
    });
  }

  // Hugo default order: weighted pages first (ascending), then by date descending.
  docs.sort((a, b) => {
    const aw = a.meta.weight > 0 ? a.meta.weight : Number.MAX_SAFE_INTEGER;
    const bw = b.meta.weight > 0 ? b.meta.weight : Number.MAX_SAFE_INTEGER;
    if (aw !== bw) return aw - bw;
    const ad = a.meta.date ? Date.parse(a.meta.date) : 0;
    const bd = b.meta.date ? Date.parse(b.meta.date) : 0;
    if (ad !== bd) return bd - ad;
    return a.meta.title.localeCompare(b.meta.title, "zh-TW");
  });

  if (CONTENT_CACHE) docsCache = docs;
  return docs;
}

export function getAllPosts(): PostMeta[] {
  return loadDocs().map((d) => d.meta);
}

/** Posts sorted newest-first regardless of weight (for archives / feeds). */
export function getPostsByDate(): PostMeta[] {
  return [...getAllPosts()].sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
}

export function getPostByUrlPath(urlPath: string): PostMeta | undefined {
  const slug = urlizePath(urlPath.replace(/^\/?post\//, "").replace(/\/+$/, ""));
  return getAllPosts().find((p) => p.slug === slug);
}

export function getPostBySegments(segments: string[]): PostMeta | undefined {
  const slug = segments.map((s) => urlize(decodeURIComponent(s))).join("/");
  return getAllPosts().find((p) => p.slug === slug);
}

/**
 * Resolve a markdown link target the way Obsidian does: first as a path
 * relative to the linking file, then by unique file name across the vault.
 * Returns the post's site-relative URL, or null when nothing matches.
 */
export function resolveDocHref(target: string, fromDirRel: string): string | null {
  const [rawPath, anchor] = target.split("#", 2);
  const decoded = decodeURIComponent(rawPath).replace(/\\/g, "/");
  if (!decoded.toLowerCase().endsWith(".md")) return null;

  const docs = loadDocs();
  const suffix = anchor ? `#${anchor}` : "";

  if (decoded.startsWith("/")) {
    const slug = urlizePath(decoded.replace(/^\/(post\/)?/, "").replace(/\.md$/i, ""));
    const hit = docs.find((d) => d.meta.slug === slug);
    return hit ? hit.meta.url + suffix : null;
  }

  const relative = path.posix.normalize(
    fromDirRel ? `${fromDirRel}/${decoded}` : decoded,
  );
  const byPath = docs.find((d) => d.meta.sourceRel === relative);
  if (byPath) return byPath.meta.url + suffix;

  const stem = path.posix.basename(decoded, path.posix.extname(decoded));
  const byName = docs.filter((d) => d.meta.stem === stem);
  if (byName.length > 0) return byName[0].meta.url + suffix;

  return null;
}

/** Resolve a `{{< postLinkCard path="/post/..." >}}` target. */
export function resolveCardTarget(cardPath: string): PostMeta | undefined {
  const slug = urlizePath(
    decodeURIComponent(cardPath).replace(/^\/?(post\/)?/, "").replace(/\/+$/, ""),
  );
  return getAllPosts().find((p) => p.slug === slug);
}

export async function getPost(segments: string[]): Promise<Post | null> {
  const meta = getPostBySegments(segments);
  if (!meta) return null;
  if (CONTENT_CACHE) {
    const cached = renderCache.get(meta.slug);
    if (cached) return cached;
  }

  const doc = loadDocs().find((d) => d.meta.slug === meta.slug)!;
  const rendered = await renderMarkdown(doc.body, {
    sourceDirRel: meta.sourceDirRel,
    stem: meta.stem,
    postUrl: meta.url,
    resolveDocHref: (target) => resolveDocHref(target, meta.sourceDirRel),
    resolveCard: (cardPath) => {
      const hit = resolveCardTarget(cardPath);
      if (!hit) return null;
      return { url: hit.url, title: hit.title, summary: hit.summary, cover: hit.cover };
    },
  });
  const post: Post = { ...meta, ...rendered };
  if (CONTENT_CACHE) renderCache.set(meta.slug, post);
  return post;
}

function buildTaxonomy(pick: (p: PostMeta) => string[]): TaxonomyTerm[] {
  const map = new Map<string, TaxonomyTerm>();
  for (const post of getPostsByDate()) {
    for (const name of pick(post)) {
      const slug = urlize(name);
      let term = map.get(slug);
      if (!term) {
        term = { name, slug, posts: [] };
        map.set(slug, term);
      }
      term.posts.push(post);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, "zh-TW"),
  );
}

export function getCategories(): TaxonomyTerm[] {
  return buildTaxonomy((p) => p.categories);
}

export function getTags(): TaxonomyTerm[] {
  return buildTaxonomy((p) => p.tags);
}

/** Previous/next posts in the global (home) order, mirroring Hugo's article nav. */
export function getAdjacentPosts(slug: string): { prev?: PostMeta; next?: PostMeta } {
  const posts = getAllPosts();
  const i = posts.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return {
    // "prev" = the newer/earlier-listed post, matching Hugo's 前一篇/後一篇.
    prev: i > 0 ? posts[i - 1] : undefined,
    next: i < posts.length - 1 ? posts[i + 1] : undefined,
  };
}

/** The standalone about page (content/about.md). */
export async function getAboutPage(): Promise<{
  title: string;
  html: string;
  toc: TocItem[];
  hasMermaid: boolean;
} | null> {
  const file = path.join(CONTENT_ROOT, "about.md");
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const rendered = await renderMarkdown(content, {
    sourceDirRel: "",
    stem: "about",
    postUrl: "/about/",
    extraImageDirs: [path.join(CONTENT_ROOT, "about")],
    resolveDocHref: (target) => resolveDocHref(target, ""),
    resolveCard: (cardPath) => {
      const hit = resolveCardTarget(cardPath);
      if (!hit) return null;
      return { url: hit.url, title: hit.title, summary: hit.summary, cover: hit.cover };
    },
  });
  return {
    title: typeof data.title === "string" && data.title ? data.title : "關於",
    ...rendered,
  };
}
