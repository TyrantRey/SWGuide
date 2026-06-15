"""Aggregate OCR'd 勳章 JSONs (written by `medal_ocr.py --save-dir`) into the
grade→type tables of a 勳章 page, filling the ## TB/GB/MB → ### 攻擊型/防禦型/功能型
skeleton.

    # print the generated body to stdout
    uv run tools/build_medal_md.py tools/.ocr-cache/SD

    # rewrite a page in place (front matter and the "## 相關資料" footer are kept,
    # everything between them is replaced by the freshly built tables)
    uv run tools/build_medal_md.py tools/.ocr-cache/SD --page "content/post/系統/勳章篇/SD 勳章.md"

Medal names carry their type and model ("攻擊型 SD：鷹眼"); the table shows only the
short name after the colon ("鷹眼") since the grade/type is already the heading.
Exact-duplicate rows (same grade + name + effect) are collapsed.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

GRADE_ORDER = ["TB", "GB", "MB"]
TYPE_ORDER = ["攻擊型", "防禦型", "功能型"]
FOOTER_MARKER = "## 相關資料"


def _normkey(s: object) -> str:
    """Normalize for dedup: NFKC folds full/half-width forms, drop whitespace."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(s or "")))


PCT_BRACKET = re.compile(r"[（(【〔]\s*[%％]\s*[）)】〕]")


def normalize_pct(s: str) -> str:
    """Fold OCR'd percent-unit brackets （%）/【%】/(%)/【％】 into a single [%]."""
    return PCT_BRACKET.sub("[%]", s)


def _cell(s: object) -> str:
    return normalize_pct(str(s or "")).replace("|", "\\|").replace("\n", " ").strip()


def medal_type(name: str) -> str:
    for t in TYPE_ORDER:
        if name.strip().startswith(t):
            return t
    return "其他"


def short_name(name: str) -> str:
    """The distinctive part: text after the (full/half-width) colon, e.g.
    "攻擊型 SD：鷹眼" -> "鷹眼". Falls back to the name minus its type prefix."""
    parts = re.split(r"[：:]", name)
    if len(parts) > 1 and parts[-1].strip():
        return parts[-1].strip()
    return re.sub(r"^(攻擊型|防禦型|功能型)\s*", "", name).strip() or name.strip()


def load_medals(cache: Path) -> list[dict]:
    medals: list[dict] = []
    for f in sorted(cache.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            print(f"warning: skipping unreadable {f.name}", file=sys.stderr)
            continue
        d["__stem"] = f.stem  # cache file name == source image stem == capture order
        medals.append(d)
    return medals


def dedup(medals: list[dict]) -> list[dict]:
    """Drop exact-duplicate rows (same grade + name + effect), keeping the first."""
    seen: set[tuple] = set()
    rows: list[dict] = []
    for m in medals:
        grade = str(m.get("勳章等級", "")).strip()
        name = str(m.get("勳章名稱", "")).strip()
        key = (grade, _normkey(name), _normkey(m.get("效果")))
        if not name or key in seen:
            continue
        seen.add(key)
        rows.append(m)
    return rows


def grouped(medals: list[dict]) -> list[tuple[str, str, list[dict]]]:
    """Ordered (grade, type, rows) groups — the canonical document order, after
    dedup. Within a group, rows keep capture order (by __stem)."""
    rows = dedup(medals)
    result: list[tuple[str, str, list[dict]]] = []
    for g in GRADE_ORDER:
        gitems = [m for m in rows if str(m.get("勳章等級", "")).strip() == g]
        if not gitems:
            continue
        by_type: dict[str, list[dict]] = {}
        for m in gitems:
            by_type.setdefault(medal_type(str(m.get("勳章名稱", ""))), []).append(m)
        ordered = [t for t in TYPE_ORDER if t in by_type] + [
            t for t in by_type if t not in TYPE_ORDER
        ]
        for t in ordered:
            items = sorted(by_type[t], key=lambda m: m.get("__stem", ""))
            result.append((g, t, items))
    return result


def build(medals: list[dict]) -> str:
    out: list[str] = []
    last_grade: str | None = None
    for g, t, items in grouped(medals):
        if g != last_grade:
            out += [f"## {g}", ""]
            last_grade = g
        out += [f"### {t}", "", "| 名稱 | 效果 |", "| ---- | ---- |"]
        for m in items:
            out.append(f"| {_cell(short_name(str(m.get('勳章名稱', ''))))} | {_cell(m.get('效果'))} |")
        out.append("")
    return "\n".join(out).strip() + "\n"


def update_page(md_path: Path, body: str) -> None:
    text = md_path.read_text(encoding="utf-8")
    fm = re.match(r"^---\n.*?\n---\n", text, re.S)
    if not fm:
        sys.exit(f"error: no front matter found in {md_path}")
    idx = text.find(FOOTER_MARKER)
    footer = text[idx:] if idx != -1 else ""
    new = text[: fm.end()] + "\n" + body + ("\n" + footer if footer else "")
    md_path.write_text(new, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Aggregate OCR'd 勳章 JSONs into a 勳章 page's grade→type tables.")
    ap.add_argument("cache", help="Directory of <stem>.json medal files (medal_ocr.py --save-dir).")
    ap.add_argument("--page", default=None, help="Markdown page to rewrite in place; without it, the body is printed.")
    args = ap.parse_args()
    if isinstance(sys.stdout, io.TextIOWrapper):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except ValueError:
            pass

    body = build(load_medals(Path(args.cache)))
    if args.page:
        update_page(Path(args.page), body)
        print(f"updated {args.page}", file=sys.stderr)
    else:
        print(body)


if __name__ == "__main__":
    main()
