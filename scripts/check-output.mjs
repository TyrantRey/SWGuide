/**
 * Post-build verification of the static export in out/:
 *  1. URL parity — every page URL of the old Hugo site (from
 *     _migration-baseline-urls.txt) must exist in out/, except consciously
 *     dropped ones (deep pagination, per-term RSS feeds, .trash junk).
 *  2. Link integrity — every internal href/src in every generated HTML file
 *     must resolve to a file in out/.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const BASELINE = path.join(ROOT, "_migration-baseline-urls.txt");

if (!fs.existsSync(OUT)) {
  console.error("out/ not found — run `npm run build` first");
  process.exit(1);
}

/* ------------------------------------------------ 1. URL parity check */

const dropped = (p) =>
  /\/page\/\d+\/index\.html$/.test(p) || // pagination pages (all posts fit on one page now)
  /^\/(categories|tags|archives)\/.*index\.xml$/.test(p) || // per-term RSS feeds
  /^\/tags\/untitled\//.test(p) || // came from .trash content
  /^\/(categories|tags)\/關於我\//.test(p); // about.md's taxonomy terms (about is no longer a "post")

let missingPages = 0;
let checkedPages = 0;
if (fs.existsSync(BASELINE)) {
  const urls = fs
    .readFileSync(BASELINE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/^﻿/, "").trim())
    .filter(Boolean);
  for (const url of urls) {
    if (dropped(url)) continue;
    checkedPages++;
    const target = path.join(OUT, url);
    if (!fs.existsSync(target)) {
      console.log(`PARITY MISS: ${url}`);
      missingPages++;
    }
  }
  console.log(`parity: ${checkedPages - missingPages}/${checkedPages} baseline URLs present`);
} else {
  console.log("baseline file missing — skipping parity check");
}

/* --------------------------------------------- 2. link integrity check */

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(full);
    else if (e.name.endsWith(".html")) yield full;
  }
}

const ATTR_RE = /(?:href|src)="([^"]+)"/g;
let badLinks = 0;
let checkedLinks = 0;

for (const file of htmlFiles(OUT)) {
  const html = fs.readFileSync(file, "utf8");
  const pageDir = path.dirname(file);
  let m;
  while ((m = ATTR_RE.exec(html))) {
    let url = m[1];
    if (
      /^(https?:)?\/\//.test(url) ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("data:") ||
      url.startsWith("#")
    )
      continue;
    url = url.split("#")[0].split("?")[0];
    if (!url) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      decoded = url;
    }
    const fsPath = decoded.startsWith("/")
      ? path.join(OUT, decoded)
      : path.resolve(pageDir, decoded);
    checkedLinks++;
    const ok =
      fs.existsSync(fsPath) &&
      (fs.statSync(fsPath).isFile() ||
        fs.existsSync(path.join(fsPath, "index.html")));
    if (!ok) {
      console.log(`BROKEN: ${decoded}  (in ${path.relative(OUT, file)})`);
      badLinks++;
    }
  }
}
console.log(`links: ${checkedLinks - badLinks}/${checkedLinks} internal refs resolve`);

if (missingPages || badLinks) process.exit(1);
console.log("verification passed ✔");
