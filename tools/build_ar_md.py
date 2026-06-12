"""Aggregate OCR'd AR-card JSONs (written by `ar_ocr.py --save-dir`) into a
Markdown card section, grouped by 類型 (主動 / 被動 / 核心).

    uv run tools/build_ar_md.py tools/.ocr-cache/1星

Prints the Markdown to stdout; splice it into the matching <N>星AR卡.md.
Exact-duplicate rows are collapsed; everything else is kept so the data can be
curated by hand afterwards.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

TYPE_ORDER = ["主動", "被動", "核心"]


def _normkey(s: object) -> str:
    """Normalize for dedup: NFKC folds full-width parens/numerals, drop whitespace."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(s or "")))


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def load_cards(cache: Path) -> list[dict]:
    cards: list[dict] = []
    for f in sorted(cache.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            print(f"warning: skipping unreadable {f.name}", file=sys.stderr)
            continue
        d["__stem"] = f.stem  # the cache file name is the source image stem
        cards.append(d)
    return cards


def _resolve_img(stem: str, img_dir: Path | None) -> str | None:
    """Image file name for a card. With img_dir, return None if the image is
    gone (an orphaned cache entry); without it, assume <stem>.png."""
    if img_dir is None:
        return f"{stem}.png"
    for m in sorted(img_dir.glob(f"{stem}.*")):
        if m.suffix.lower() in IMAGE_EXTS:
            return m.name
    return None


def _level(v: object) -> str:
    if isinstance(v, (int, float, str)):
        try:
            return f"+{int(v)}"
        except (TypeError, ValueError):
            return "+0"
    return "+0"


def _cell(s: object) -> str:
    return str(s or "").replace("|", "\\|").replace("\n", " ").strip()


def build(cards: list[dict], img_dir: Path | None = None) -> str:
    # Drop orphaned cache entries whose source image was deleted (no broken refs).
    if img_dir is not None:
        kept = [c for c in cards if _resolve_img(c.get("__stem", ""), img_dir)]
        if len(kept) != len(cards):
            print(f"note: skipping {len(cards) - len(kept)} card(s) with no image on disk", file=sys.stderr)
        cards = kept

    seen: set[tuple] = set()
    rows: list[dict] = []
    for c in cards:
        key = (_normkey(c.get("卡名")), str(c.get("等級", "")), _normkey(c.get("能力名字")), _normkey(c.get("能力描述")))
        if key in seen:
            continue
        seen.add(key)
        rows.append(c)

    groups: dict[str, list[dict]] = {}
    for c in rows:
        groups.setdefault(c.get("類型") or "其他", []).append(c)

    with_img = img_dir is not None
    header = (["圖"] if with_img else []) + ["卡名", "等級", "稀有度", "能力", "效果"]
    out = [f"共 {len(rows)} 張卡片（由 OCR 自動整理）。", ""]
    ordered = [t for t in TYPE_ORDER if t in groups] + [t for t in groups if t not in TYPE_ORDER]
    for t in ordered:
        items = sorted(groups[t], key=lambda c: (_cell(c.get("卡名")), str(c.get("等級", ""))))
        out.append(f"### {t}（{len(items)}）")
        out.append("")
        out.append("| " + " | ".join(header) + " |")
        out.append("| " + " | ".join("----" for _ in header) + " |")
        for c in items:
            cells = [f"![]({_resolve_img(c.get('__stem', ''), img_dir)})"] if with_img else []
            cells += [
                _cell(c.get("卡名")),
                _level(c.get("等級")),
                _cell(c.get("稀有度")),
                _cell(c.get("能力名字")),
                _cell(c.get("能力描述")),
            ]
            out.append("| " + " | ".join(cells) + " |")
        out.append("")
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser(description="Aggregate OCR'd AR-card JSONs into a Markdown section.")
    ap.add_argument("cache", help="Directory of <stem>.json card files (ar_ocr.py --save-dir).")
    ap.add_argument("--img-dir", default=None, help="Folder with the card images; adds an image (圖) column.")
    args = ap.parse_args()
    if isinstance(sys.stdout, io.TextIOWrapper):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except ValueError:
            pass
    img_dir = Path(args.img_dir) if args.img_dir else None
    print(build(load_cards(Path(args.cache)), img_dir))


if __name__ == "__main__":
    main()
