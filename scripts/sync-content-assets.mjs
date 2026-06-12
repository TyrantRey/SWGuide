/**
 * Copies every non-markdown file under content/ into public/ so that
 * co-located Obsidian images keep their Hugo-era URLs
 * (e.g. content/post/副本/主要副本/必然災禍/file-x.png
 *   -> /post/副本/主要副本/必然災禍/file-x.png,
 *  and content/about/image.png -> /about/image.png).
 *
 * Directory segments are urlized exactly like page slugs (see lib/urlize.ts);
 * file names are kept as-is — both verified against the Hugo build output.
 *
 * The generated zones (public/post, public/about, public/archives) are wiped
 * on every run; never put hand-made files there.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "content");
const DEST = path.join(ROOT, "public");
const SKIP_DIRS = new Set(["Template"]);
const GENERATED_ZONES = ["post", "about", "archives"];

/** Keep in sync with lib/urlize.ts. */
function urlize(segment) {
  return segment
    .trim()
    .replace(/['"<>?#%{}|\\^`\[\]]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

for (const zone of GENERATED_ZONES) {
  fs.rmSync(path.join(DEST, zone), { recursive: true, force: true });
}

let copied = 0;
function walk(dir, destSegments) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, [...destSegments, urlize(entry.name)]);
    } else if (entry.isFile() && !/\.md$/i.test(entry.name)) {
      const destDir = path.join(DEST, ...destSegments);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(full, path.join(destDir, entry.name));
      copied += 1;
    }
  }
}

walk(SRC, []);
console.log(`[sync-content-assets] copied ${copied} files into public/`);
