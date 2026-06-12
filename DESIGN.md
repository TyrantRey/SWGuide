# SWGuide design & implementation contract

Dark anime game-guide aesthetic for the SoulWorker (靈魂行者) guide. Think official
anime-MMO site / HUD: neon cyan + magenta accents on deep navy, angular clipped
panels, Rajdhani for English HUD labels, Noto Sans TC for body text. Everything is
statically exported (`output: "export"`), Traditional Chinese (`zh-TW`).

## Stack rules (Next.js 15 / React 19, static export)

- **`params` is a Promise** in pages/layouts/metadata: `const { slug } = await params;`.
- Dynamic routes MUST define `generateStaticParams` and `export const dynamicParams = false;`.
- Server components by default; add `"use client"` only where interaction needs it.
- **Never** use `headers()`, `cookies()`, `searchParams`-dependent rendering, or `next/image` — use plain `<img>`.
- Internal navigation uses `<Link href="/post/…/">` (Next applies the GitHub-Pages basePath automatically).
- Any URL emitted as a **raw attribute** (e.g. `<img src>`, RSS/sitemap, `dangerouslySetInnerHTML` is already handled) must go through `withBase(encodePath(path))` from `@/lib/site` + `@/lib/urlize`; absolute URLs for feeds use `absoluteUrl(encodePath(path))`.
- Route params arrive percent-encoded at dev time: always pass them through the lib lookups (they decode internally) — never compare raw param strings to slugs yourself.
- Do NOT run `npm run build` / `tsc` (the orchestrator integrates and builds). Just write correct TypeScript (strict mode).
- Do NOT edit shared files: `app/globals.css`, `app/layout.tsx`, `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/PostCard.tsx`, anything in `lib/`. If you need a new global style, note it in your final report instead.

## Data API (`@/lib/content`) — all synchronous unless noted

- `getAllPosts(): PostMeta[]` — home order (weighted first, then newest).
- `getPostsByDate(): PostMeta[]` — newest first (archives/feeds).
- `getPost(segments: string[]): Promise<Post|null>` — rendered post (`html`, `toc: {id,text,depth}[]`, `hasMermaid`).
- `getPostBySegments(segments)` / `getPostByUrlPath("/post/…")` — meta lookup.
- `getCategories() / getTags(): TaxonomyTerm[]` — `{name, slug, posts}`, sorted by count.
- `getAdjacentPosts(slug): {prev?, next?}` — global-order neighbours.
- `getAboutPage(): Promise<{title, html, toc, hasMermaid}|null>`.

`PostMeta`: `slug, segments, url (/post/…/ with trailing slash), title, date (ISO), lastmod,
summary, description, keywords, weight, categories[], tags[], cover (site-relative,
always set), hasExplicitCover, wordCount, readingMinutes`.

`@/lib/site`: `SITE_TITLE, SITE_SUBTITLE, SITE_DESCRIPTION, SITE_AUTHOR, SITE_ORIGIN,
BASE_PATH, SINCE_YEAR, OUTDATE_DAYS, SOCIAL_LINKS, BANNER_IMAGE, AVATAR_IMAGE,
COVER_POOL, withBase(), absoluteUrl()`.
`@/lib/format`: `formatDate(iso) → "2025-09-28"`, `formatYearMonth`, `formatYear`.
`@/lib/urlize`: `urlize`, `urlizePath`, `encodePath`.

## Design tokens (Tailwind utilities, defined in globals.css `@theme`)

Colors: `bg` `surface` `panel` `panel-bright` `line` `line-bright` (borders/bg),
`ink` `ink-dim` `ink-faint` (text), accents `cyan` `cyan-deep` `magenta` `violet`
`gold` `green` `red`. Fonts: `font-display` (Rajdhani — English HUD labels, digits,
letter-spaced uppercase), `font-sans` (Noto Sans TC — default).

Custom classes ready to use:
- `.hud-chip` — small uppercase neon section label (e.g. `<div className="hud-chip">CHARACTERS</div>`).
- `.section-title` — big display heading; pair with hud-chip above it.
- `.panel` — angular clipped panel with hover glow + corner tick (cards). Add `panel-static` to suppress hover.
- `.capsule` / `.capsule--accent` — category (cyan) / tag (magenta) chips.
- `.neon-text`, `.text-gradient` — hero/title effects.
- `.prose` — full article styling (headings, tables, callouts, `.post-link-card`, `.video-embed`, images). Wrap rendered post HTML: `<div className="prose" dangerouslySetInnerHTML={{__html: post.html}} />`.

Layout conventions: page container `mx-auto max-w-6xl px-4` (articles `max-w-4xl`
for the text column). Section spacing `py-12`/`py-16`. Every page starts with a
hud-chip + section-title header. Bilingual flavor: zh-TW primary, small
letter-spaced English HUD labels as decoration (e.g. 彙整 + "ARCHIVES").
Use generous hover transitions (`transition-…`, glow shadows like
`shadow-[0_0_24px_rgba(61,232,255,0.18)]`). Keep it readable: body text `text-ink`,
secondary `text-ink-dim`, decoration `text-ink-faint`.

## Site map

`/` home · `/post/<…slug>/` 55 posts · `/archives/` · `/categories/` + `/categories/<slug>/`
· `/tags/` + `/tags/<slug>/` · `/about/` · 404 · `/index.xml` RSS · `/sitemap.xml`.
