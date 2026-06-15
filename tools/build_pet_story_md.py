"""Aggregate OCR'd 靈魂小夥伴 故事 JSONs (written by `pet_story_ocr.py --save-dir`)
into a Markdown table keyed by pet, with one column per tier (S / SS / SSS).

    uv run tools/build_pet_story_md.py tools/.ocr-cache/S級故事

Prints the Markdown to stdout; splice it under '### 故事' in <級>級靈魂小夥伴.md.
The cache files are read in filename (= capture) order and grouped into pets: a
new pet starts at each S-tier screen, and the following SS / SSS screens fill that
pet's row. Any tier with no screen — or any field the OCR could not read — is left
as "N/A". Pure-stdlib (no deps).
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

NA = "N/A"
LEVELS = ["S", "SS", "SSS"]


def load_stories(cache: Path) -> list[dict]:
    stories: list[dict] = []
    for f in sorted(cache.glob("*.json")):  # filename == in-game capture order
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            print(f"warning: skipping unreadable {f.name}", file=sys.stderr)
            continue
        d["__stem"] = f.stem
        stories.append(d)
    return stories


def _cell(s: object) -> str:
    return str(s if s is not None else "").replace("|", "\\|").replace("\n", " ").strip()


def _is_blank(s: object) -> bool:
    return _cell(s) in ("", NA)


def _tier_cell(story: dict | None) -> str:
    """Render one tier as '**標題**：故事', degrading to whichever part is present."""
    if story is None:
        return NA
    title = _cell(story.get("標題"))
    body = _cell(story.get("故事"))
    t_blank, b_blank = title in ("", NA), body in ("", NA)
    if t_blank and b_blank:
        return NA
    if t_blank:
        return body
    if b_blank:
        return f"**{title}**"
    return f"**{title}**：{body}"


def _group(stories: list[dict]) -> list[dict]:
    """Group consecutive screens into pets. A new pet begins at each S-tier screen
    (or whenever the current pet already has a screen for that tier)."""
    groups: list[dict] = []
    cur: dict | None = None
    for s in stories:
        lvl = s.get("等級", NA)
        start_new = cur is None or lvl == "S" or (lvl in LEVELS and lvl in cur["tiers"])
        if start_new:
            cur = {"名稱": NA, "tiers": {}}
            groups.append(cur)
        assert cur is not None
        if lvl in LEVELS:
            cur["tiers"].setdefault(lvl, s)
        else:  # tier unreadable: park it in the first open slot so it isn't lost
            for lv in LEVELS:
                if lv not in cur["tiers"]:
                    cur["tiers"][lv] = s
                    break
        if _is_blank(cur["名稱"]) and not _is_blank(s.get("名稱")):
            cur["名稱"] = _cell(s.get("名稱"))
    return groups


def _norm_name(s: object) -> str:
    """Fold for name matching: drop spaces so '索爾 巴得凱' == '索爾巴得凱'."""
    return "".join(str(s or "").split())


def _row(name: str, group: dict | None) -> str:
    cells = [_cell(name) or NA]
    tiers = group["tiers"] if group else {}
    cells += [_tier_cell(tiers.get(lv)) for lv in LEVELS]
    return "| " + " | ".join(cells) + " |"


def build(stories: list[dict], names: list[str] | None = None, roster: list[str] | None = None) -> str:
    """Build the 名稱|S|SS|SSS table.

    names  — override each group's auto-detected 名稱, applied in capture order
             (the story-screen name OCR is unreliable, so this is the trusted source).
    roster — emit exactly one row per roster pet, in roster order; a pet with no
             captured story gets an all-N/A row. Groups not in the roster are still
             appended (and reported), so nothing captured is silently dropped.
    """
    groups = _group(stories)
    if names:
        for g, nm in zip(groups, names):
            if nm.strip():
                g["名稱"] = nm.strip()

    out = ["| " + " | ".join(["名稱", *LEVELS]) + " |",
           "| " + " | ".join("----" for _ in ["名稱", *LEVELS]) + " |"]

    if roster:
        by_name = {_norm_name(g["名稱"]): g for g in groups if not _is_blank(g["名稱"])}
        used: set[str] = set()
        for pet in roster:
            g = by_name.get(_norm_name(pet))
            if g is not None:
                used.add(_norm_name(g["名稱"]))
            out.append(_row(pet, g))
        leftovers = [g for g in groups if _norm_name(g["名稱"]) not in used]
        for g in leftovers:
            label = _cell(g["名稱"]) or NA
            print(f"note: story group '{label}' not in roster — appended at end", file=sys.stderr)
            out.append(_row(label, g))
        n = len(roster) + len(leftovers)
    else:
        for g in groups:
            out.append(_row(_cell(g["名稱"]) or NA, g))
        n = len(groups)

    return "\n".join([f"共 {n} 隻靈魂小夥伴的故事（由 OCR 自動整理）。", "", *out, ""])


def main() -> None:
    ap = argparse.ArgumentParser(description="Aggregate OCR'd 靈魂小夥伴 故事 JSONs into a Markdown table.")
    ap.add_argument("cache", help="Directory of <stem>.json story files (pet_story_ocr.py --save-dir).")
    ap.add_argument("--names", default=None, help="Comma-separated pet names to label the groups in capture order (the story-screen name OCR is unreliable; this overrides it).")
    ap.add_argument("--roster", default=None, help="Comma-separated full pet roster; output one row per roster pet in this order, N/A for pets with no captured story.")
    ap.add_argument("--levels", default=None, help="Comma-separated tier columns (default: S,SS,SSS). Use 'S,SS' for ranks that only have two story tiers; a tier the OCR over-reads (e.g. SS misread as SSS) folds into the next open column.")
    args = ap.parse_args()
    if isinstance(sys.stdout, io.TextIOWrapper):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except ValueError:
            pass
    if args.levels:
        globals()["LEVELS"] = [s.strip() for s in args.levels.split(",") if s.strip()]
    names = [s for s in args.names.split(",")] if args.names else None
    roster = [s.strip() for s in args.roster.split(",") if s.strip()] if args.roster else None
    print(build(load_stories(Path(args.cache)), names, roster))


if __name__ == "__main__":
    main()
