# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Hugo** static site — a Traditional Chinese (`zh-TW`) game guide for *SoulWorker* (《靈魂行者退坑指南》). Content is prose/Markdown, not application code. It is authored in **Obsidian** and deployed to GitHub Pages. There is no application to run or test suite; "building" means rendering Markdown to HTML with Hugo.

## Commands

```bash
# First-time setup — the theme is a git submodule and MUST be fetched before any build
git submodule update --init --recursive

# Local preview at http://localhost:1313 (-D includes draft posts)
hugo server -D

# Production build into ./public (matches CI flags)
hugo --minify

# Create a new post (category is auto-filled from the folder via archetypes/default.md)
hugo new post/<category>/<name>.md

# Lint / format (Trunk wraps markdownlint, prettier, yamllint, taplo for TOML, etc.)
trunk check
trunk fmt
```

Requires **Hugo extended** (CI pins `0.128.0`) and Dart Sass — the theme compiles SCSS, so the plain (non-extended) Hugo will fail.

## Deployment

`.github/workflows/hugo.yml` runs on every push to `main`: checks out submodules recursively, builds with `hugo --minify`, and publishes `./public` to the **`gh-pages`** branch via `peaceiris/actions-gh-pages`. Site is served at `https://tyrantrey.github.io`. Do not commit `public/` (gitignored) — it is generated.

## Configuration layout

Config is intentionally split:

- **`hugo.toml`** — site-level Hugo settings: `baseURL`, `title`, `theme`, languages, and `ignoreFiles`.
- **`config/_default/params.yml`** — all *theme* (reimu) parameters: nav menu, sidebar/widgets, comment systems, fonts, dark mode, KaTeX math, animations, footer. This is where most visual/behavioral tweaks go, not `hugo.toml`.
- **`data/covers.yml`** — pool of random post-cover images (used when a post has no `cover`).
- **`data/vendor.yml`** — CDN/vendor asset definitions for the theme.

## Theme & overrides

The theme is **hugo-theme-reimu**, pulled as a git submodule at `themes/reimu/` (`url` in `.gitmodules`). The root-level `layouts/`, `static/`, `assets/`, and `i18n/` directories **mirror and override** the theme's equivalents (Hugo resolves project files before theme files). The root `layouts/` files are currently identical copies of the theme's — edit those copies to customize rendering without touching the submodule.

Custom shortcodes live in `layouts/shortcodes/` — notably `postLinkCard`, `externalLinkCard`, `heatMapCard`, `tagRoulette`, `friendsLink`, `bilibili`, `youtube`. Obsidian-style callouts (`> [!warning]`) are rendered by `layouts/_default/_markup/render-blockquote-alert.html`.

## Content conventions

Posts live under `content/post/`, grouped into category folders: `前言`, `入坑前`, `回鍋入坑`, `系統`, `角色篇`, `資源篇`, `副本`. A post may be either a single `.md` file (e.g. `content/post/前言.md`) or a folder bundle holding the `.md` plus its co-located images.

Front matter (see `archetypes/default.md` for the template and `content/post/前言.md` for a real example):

- `categories` is auto-derived from the containing folder name by the archetype — keep posts in the right folder.
- `weight` controls ordering within a section (lower = earlier); sort behavior is configured under `sort_order` in `params.yml`.
- `math` / `mermaid` toggle KaTeX and Mermaid per page (both default off in the archetype).
- `summary` feeds the post excerpt; `draft: true` hides a post from production builds.

Authoring is done in **Obsidian** (`content/post/.obsidian/` holds the vault config). Images use Obsidian attachment naming (e.g. `file-20250907153633470.png`) and sit next to the post. The `.obsidian/`, `.trash/`, and `Template/` folders are excluded from the build.

## Gotchas

- **`ignoreFiles` in `hugo.toml` uses absolute Windows paths** (`D:/Code/SWGuide/post/Template/...`). These are machine-specific and will not match on another machine or in CI — prefer the repo-relative globs already present (e.g. `content/.obsidian/*`) when adding exclusions.
- The site **will not build without the submodule** — if `themes/reimu/` is empty, run the submodule init command above.
- `.gitignore` excludes generated/local dirs: `public/`, `resources/`, `.frontmatter/`, `.obsidian/`, `Template/`.
