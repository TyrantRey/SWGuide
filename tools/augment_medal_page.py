"""Augment an already-curated 勳章 page in place: prepend an image (圖) column to
every table, copy the referenced screenshots into the post's Obsidian sibling
folder, and apply two light fixes — fold percent brackets to [%], and force the
傷害減少 BOSS/中級怪物 row's name to 鸚螺.

Why a separate tool from build_medal_md.py: the page has already been hand-curated
(some effect cells fixed by hand), so we must NOT regenerate from the OCR cache.
Instead we keep the on-disk rows verbatim and only add the image column. Images map
to rows by position — the cache's grouped() order matches the document order, and
a per-section row-count check aborts if anything has drifted.

    uv run tools/augment_medal_page.py SD
    uv run tools/augment_medal_page.py SD BSK FOT SIN

Image reference is the bare file name (e.g. ![image](file-x.png)); it resolves
against the post URL because sync-content-assets.mjs copies the sibling folder to
the same urlized path. Re-running on an already-augmented page is a no-op-guarded
error (rows would have 3 cells, not 2) so it won't double-insert.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, "tools")
import build_medal_md as B  # noqa: E402

POST_DIR = Path("content/post/系統/勳章篇")
CAPTURE_DIR = Path("tools/captures")
CACHE_DIR = Path("tools/.ocr-cache")
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
GRADE_RE = re.compile(r"^## (TB|GB|MB)\b")
TYPE_RE = re.compile(r"^### (\S+)")


def fix_cells(name: str, effect: str) -> tuple[str, str]:
    name = B.normalize_pct(name)
    effect = B.normalize_pct(effect)
    if "傷害減少" in effect and "中級怪物" in effect:
        name = "鸚螺"
    return name, effect


def resolve_filename(stem: str, cap: Path) -> str:
    for ext in IMAGE_EXTS:
        if (cap / f"{stem}{ext}").exists():
            return f"{stem}{ext}"
    return f"{stem}.png"


def augment(setname: str) -> None:
    cache = CACHE_DIR / setname
    cap = CAPTURE_DIR / setname
    md_path = POST_DIR / f"{setname} 勳章.md"
    img_out = POST_DIR / f"{setname} 勳章"
    if not md_path.exists():
        sys.exit(f"error: page not found: {md_path}")

    # (grade, type) -> ordered stems, exactly as the rows appear in the document.
    stem_map: dict[tuple[str, str], list[str]] = {}
    referenced: list[str] = []
    for g, t, items in B.grouped(B.load_medals(cache)):
        stems = [str(m.get("__stem", "")) for m in items]
        stem_map[(g, t)] = stems
        referenced += stems

    # Copy only the referenced screenshots into the post's sibling folder.
    img_out.mkdir(parents=True, exist_ok=True)
    for stem in referenced:
        fn = resolve_filename(stem, cap)
        src = cap / fn
        if src.exists():
            shutil.copyfile(src, img_out / fn)

    lines = md_path.read_text(encoding="utf-8").split("\n")
    out: list[str] = []
    grade: str | None = None
    mtype: str | None = None
    consumed: dict[tuple[str, str], int] = {}
    footer = False

    for ln in lines:
        if ln.startswith("## 相關資料"):
            footer = True
        if footer or not ln.startswith(("#", "|")):
            out.append(ln)
            continue

        mg = GRADE_RE.match(ln)
        if mg:
            grade, mtype = mg.group(1), None
            out.append(ln)
            continue
        mt = TYPE_RE.match(ln)
        if mt:
            mtype = mt.group(1)
            out.append(ln)
            continue
        if not ln.startswith("|"):
            out.append(ln)
            continue

        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if "名稱" in cells and "效果" in cells:  # header row
            out.append("| 圖 | 名稱 | 效果 |")
            continue
        if all(c and set(c) <= set("-: ") for c in cells):  # separator row
            out.append("| --- | --- | --- |")
            continue
        # data row
        if len(cells) != 2:
            sys.exit(f"error: {md_path}: expected 2 cells, got {len(cells)} in: {ln!r}")
        if grade is None or mtype is None:
            sys.exit(f"error: {md_path}: data row outside a grade/type section: {ln!r}")
        name, effect = fix_cells(cells[0], cells[1])
        stems = stem_map.get((grade, mtype), [])
        k = consumed.get((grade, mtype), 0)
        if k >= len(stems):
            sys.exit(f"error: {md_path}: more rows than images at {grade}/{mtype}")
        consumed[(grade, mtype)] = k + 1
        out.append(f"| ![image]({resolve_filename(stems[k], cap)}) | {name} | {effect} |")

    for key, stems in stem_map.items():
        if consumed.get(key, 0) != len(stems):
            sys.exit(f"error: {md_path}: mapped {consumed.get(key, 0)}/{len(stems)} images at {key}")

    md_path.write_text("\n".join(out), encoding="utf-8")
    print(f"{setname}: +{len(referenced)} images into {img_out}", file=sys.stderr)


def main() -> None:
    sets = sys.argv[1:] or ["SD", "BSK", "FOT", "SIN"]
    for s in sets:
        augment(s)


if __name__ == "__main__":
    main()
