# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Next.js 15** static-export site — a Traditional Chinese (`zh-TW`) game guide for *SoulWorker* (《靈魂行者退坑指南》) with a dark anime/HUD design (see `DESIGN.md` for the binding design + implementation contract). Guide content is plain Markdown under `content/post/`, authored in **Obsidian**, and deployed to GitHub Pages. The site was migrated from Hugo; URL compatibility with the old Hugo build is a hard requirement.

## Commands

```bash
pnpm install         # first-time setup (Node 22, pnpm — version pinned in package.json#packageManager)

pnpm dev             # sync content images + dev server at http://localhost:3000
pnpm build           # sync + static export into ./out (what CI deploys)
pnpm check           # tsc --noEmit
node scripts/check-output.mjs   # after a build: URL parity + internal link check

# Lint / format (Trunk wraps markdownlint, prettier, yamllint, etc.)
trunk check
trunk fmt
```

## Architecture

- **`content/post/`** — the source of truth: Markdown posts in category folders (前言, 入坑前, 回鍋入坑, 系統, 角色篇, 副本). Images sit in a sibling folder named after the post (Obsidian attachment style). `.obsidian/`, `.trash/`, `Template/` are excluded everywhere.
- **`lib/content.ts`** — content indexer: walks `content/post`, parses front matter, builds Hugo-compatible slugs, taxonomies, adjacent-post navigation. **`lib/urlize.ts`** replicates Hugo's URL rules (ASCII lowercased, whitespace→`-`, CJK preserved — `AR卡篇/1星AR卡.md` → `/post/系統/ar卡篇/1星ar卡/`). Do not change slug logic without re-running the parity check.
- **`lib/markdown.ts`** — unified/remark/rehype pipeline: GFM, Obsidian callouts (`> [!note]` etc. → `.callout` divs), Hugo shortcodes still in the Markdown (`{{< postLinkCard >}}`, `{{< youtube >}}`, `{{< bilibili >}}`), Obsidian-style `.md` link resolution (relative first, then unique-filename lookup), relative image rewriting with width/height, heading anchors + TOC, mermaid fences.
- **`app/`** — routes: home, `post/[...slug]` (55 posts), archives, categories/tags (+ term pages), about (renders `content/about.md`), `index.xml` RSS, sitemap, 404.
- **`app/globals.css`** — the entire design system (Tailwind v4 `@theme` tokens + `.prose` article styles + `.callout`/`.post-link-card`/`.video-embed` classes emitted by the markdown pipeline).
- **`scripts/sync-content-assets.mjs`** — runs before dev/build: copies non-`.md` files from `content/post` into `public/post/<urlized-path>/` so co-located images keep their Hugo-era URLs. `public/post/` is generated — never hand-edit, it is gitignored and wiped on each sync.
- **`public/`** — committed static assets (`covers/`, `images/`, `avatar/`, `副本/`, `.nojekyll`) plus the generated `public/post/`.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, `npm run build` with `NEXT_PUBLIC_BASE_PATH` from `actions/configure-pages` (`/<repo>` for project pages), then publishes `./out` to the **`gh-pages`** branch via `peaceiris/actions-gh-pages`. Never commit `out/` or `.next/`.

## Conventions & gotchas

- **basePath discipline**: internal navigation uses `<Link>` (basePath applied automatically). Any URL emitted as a raw attribute must go through `withBase(encodePath(...))` (`lib/site.ts` / `lib/urlize.ts`). Inside rendered markdown HTML this is already handled by `lib/markdown.ts`.
- **Static export rules**: every dynamic route has `generateStaticParams` + `dynamicParams = false`; no `headers()`/`cookies()`; plain `<img>` instead of `next/image`. `next.config.ts` applies `output: "export"` **only in the production build phase** (`PHASE_PRODUCTION_BUILD`) — enabling it for `next dev` makes the dev server reject this site's percent-encoded CJK catch-all URLs with `… is missing param "/post/[...slug]" …` ([next#56477](https://github.com/vercel/next.js/issues/56477)). Don't move `output` back to the top level.
- Front matter (`title, date, lastmod, summary, description, keywords, weight, categories, tags, cover, draft`): `weight` pins a post to the top of the home order; `draft: true` excludes a post; empty `cover` gets a deterministic pick from the `covers/` pool.
- New post = drop a `.md` file into the right category folder (the folder name becomes the category path and URL); images go in a sibling folder named after the file (Obsidian default).
- `_migration-baseline-urls.txt` / `_migration-baseline-files.txt` (gitignored, regenerable from the pre-migration Hugo build) feed `scripts/check-output.mjs`'s parity check. Consciously dropped vs Hugo: deep pagination URLs (`/page/N/`), per-taxonomy RSS feeds, and `.trash`-derived pages.
