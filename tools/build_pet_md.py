"""Aggregate OCR'd 靈魂小夥伴 JSONs (written by `pet_ocr.py --save-dir`) into a
Markdown table of soul-companions.

    uv run tools/build_pet_md.py tools/.ocr-cache/S級

Prints the Markdown to stdout; splice it into the matching <級>級靈魂小夥伴.md.
Each row is one pet: its 能力值 (stat list) rendered inline plus its 技能.
Exact-duplicate rows are collapsed; everything else is kept so the data can be
curated by hand afterwards. Pure-stdlib (no deps).
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def _normkey(s: object) -> str:
    """Normalize for dedup: NFKC folds full-width parens/numerals, drop whitespace."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(s or "")))


def load_pets(cache: Path) -> list[dict]:
    pets: list[dict] = []
    for f in sorted(cache.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            print(f"warning: skipping unreadable {f.name}", file=sys.stderr)
            continue
        d["__stem"] = f.stem  # the cache file name is the source image stem
        pets.append(d)
    return pets


def _resolve_img(stem: str, img_dir: Path | None) -> str | None:
    """Image file name for a pet. With img_dir, return None if the image is
    gone (an orphaned cache entry); without it, assume <stem>.png."""
    if img_dir is None:
        return f"{stem}.png"
    for m in sorted(img_dir.glob(f"{stem}.*")):
        if m.suffix.lower() in IMAGE_EXTS:
            return m.name
    return None


def _cell(s: object) -> str:
    return str(s if s is not None else "").replace("|", "\\|").replace("\n", " ").strip()


def _fmt_val(v: object) -> str:
    """Re-add thousands separators to plain integers; leave unit strings (5.0%) be."""
    if isinstance(v, bool):
        return str(int(v))
    if isinstance(v, int):
        return f"{v:,}"
    if isinstance(v, float):
        return f"{v:,.10g}" if v % 1 else f"{int(v):,}"
    return str(v if v is not None else "")


def _stats_str(stats: object) -> str:
    """Render the 能力值 list ([{name: val}, …]) as 'name val；name val'."""
    parts: list[str] = []
    if isinstance(stats, list):
        for d in stats:
            if isinstance(d, dict):
                for k, v in d.items():
                    parts.append(f"{_cell(k)} {_cell(_fmt_val(v))}".strip())
    elif isinstance(stats, dict):
        for k, v in stats.items():
            parts.append(f"{_cell(k)} {_cell(_fmt_val(v))}".strip())
    return "；".join(p for p in parts if p)


def _skill_name(skill: str) -> str:
    """Best-effort lead skill name (the part before the first full/half-width colon)."""
    return re.split(r"[：:]", skill, maxsplit=1)[0].strip()


def build(pets: list[dict], img_dir: Path | None = None) -> str:
    # Drop orphaned cache entries whose source image was deleted (no broken refs).
    if img_dir is not None:
        kept = [p for p in pets if _resolve_img(p.get("__stem", ""), img_dir)]
        if len(kept) != len(pets):
            print(f"note: skipping {len(pets) - len(kept)} pet(s) with no image on disk", file=sys.stderr)
        pets = kept

    seen: set[tuple] = set()
    rows: list[dict] = []
    for p in pets:
        stats = _stats_str(p.get("靈魂小夥伴能力值"))
        skill = _cell(p.get("靈魂小夥伴技能"))
        key = (_normkey(stats), _normkey(skill))
        if key in seen:
            continue
        seen.add(key)
        rows.append({"__stem": p.get("__stem", ""), "能力值": stats, "技能": skill})

    rows.sort(key=lambda r: (_skill_name(r["技能"]), r["能力值"]))

    with_img = img_dir is not None
    header = (["圖"] if with_img else []) + ["能力值", "技能"]
    out = [f"共 {len(rows)} 隻靈魂小夥伴（由 OCR 自動整理）。", ""]
    out.append("| " + " | ".join(header) + " |")
    out.append("| " + " | ".join("----" for _ in header) + " |")
    for r in rows:
        cells = [f"![]({_resolve_img(r['__stem'], img_dir)})"] if with_img else []
        cells += [r["能力值"], r["技能"]]
        out.append("| " + " | ".join(cells) + " |")
    out.append("")
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser(description="Aggregate OCR'd 靈魂小夥伴 JSONs into a Markdown table.")
    ap.add_argument("cache", help="Directory of <stem>.json pet files (pet_ocr.py --save-dir).")
    ap.add_argument("--img-dir", default=None, help="Folder with the pet images; adds an image (圖) column.")
    args = ap.parse_args()
    if isinstance(sys.stdout, io.TextIOWrapper):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except ValueError:
            pass
    img_dir = Path(args.img_dir) if args.img_dir else None
    print(build(load_pets(Path(args.cache)), img_dir))


if __name__ == "__main__":
    main()
