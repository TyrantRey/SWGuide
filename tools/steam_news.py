"""Fetch Steam news/announcements for an app and write one Markdown file per item.

Pipeline:  Steam ISteamNews API  ->  detect language (title script)  ->  YAML
frontmatter + BBCode-to-Markdown body  ->  ./steam/{language}/{gid}.md

Run with uv (deps are declared inline above, no manual install needed):

    uv run tools/steam_news.py                 # appid 1377580 (SoulWorker), count 100
    uv run tools/steam_news.py --count 50
    uv run tools/steam_news.py --appid 730 --output ./steam --lang zh-tw

Each news item becomes  ./steam/<lang>/<gid>.md, where <lang> is 'en' or 'zh-tw'
-- the only languages this feed publishes. Detection runs on the title only
(bodies are often multilingual) using a Unicode-script test, since a statistical
detector is unreliable on titles this short.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

API_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
DEFAULT_APPID = "1377580"  # SoulWorker
DEFAULT_COUNT = 100

# Steam replaces this placeholder with its CDN image host at render time.
STEAM_CLAN_IMAGE = "https://clan.akamai.steamstatic.com/images"


# --------------------------------------------------------------------------- #
# Steam API
# --------------------------------------------------------------------------- #
def fetch_news(appid: str, count: int) -> list[dict]:
    """Return the list of newsitems for an app from the Steam Web API."""
    resp = requests.get(
        API_URL,
        params={"appid": appid, "count": count},
        timeout=30,
        headers={"User-Agent": "steam-news-md/1.0"},
    )
    resp.raise_for_status()
    return resp.json().get("appnews", {}).get("newsitems", [])


# --------------------------------------------------------------------------- #
# Language detection
# --------------------------------------------------------------------------- #
def _plain_text(item: dict) -> str:
    """The item title with bracket labels / URL noise stripped, for detection.

    Detection uses the title only -- bodies are often multilingual (an English
    notice may embed a Korean/Japanese product name), which misroutes the post.
    Full-width CJK brackets like 【】 are preserved; only ASCII [tag] labels go.
    """
    text = item.get("title", "")
    text = re.sub(r"\[/?[^\]]*\]", " ", text)  # drop ASCII [Notice]/[Event] labels
    text = re.sub(r"https?://\S+", " ", text)  # drop bare urls
    return text.strip()


def _script_counts(text: str) -> tuple[int, int, int, int]:
    """Return (han, hangul, kana, latin) *letter* counts for CJK-family routing.

    Only Unicode letters are counted, so CJK punctuation that lives inside the
    script blocks -- e.g. the katakana middle dot U+30FB or full-width space --
    does not get mistaken for real kana/kanji.
    """
    han = hangul = kana = latin = 0
    for ch in text:
        o = ord(ch)
        if not unicodedata.category(ch).startswith("L"):
            continue
        if 0xAC00 <= o <= 0xD7A3 or 0x1100 <= o <= 0x11FF or 0x3130 <= o <= 0x318F:
            hangul += 1
        elif 0x3040 <= o <= 0x309F or 0x30A0 <= o <= 0x30FF:
            kana += 1
        elif 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0xF900 <= o <= 0xFAFF:
            han += 1
        elif ch.isascii():
            latin += 1
    return han, hangul, kana, latin


def detect_language(item: dict) -> str:
    """Language code for a news item: 'zh-tw' or 'en'.

    This feed only publishes English and Traditional Chinese, so detection is a
    Unicode-script test on the title: if the title carries Han characters (and is
    not dominated by another CJK script) it is Traditional Chinese, otherwise it
    is English. We deliberately do not use a statistical detector like langdetect
    -- on titles this short it is unreliable (it tags English titles as af/nl/de
    and Traditional Chinese as Korean), whereas the script test is deterministic.
    """
    text = _plain_text(item)
    han, hangul, kana, _latin = _script_counts(text)
    return "zh-tw" if han and han >= hangul and han >= kana else "en"


# --------------------------------------------------------------------------- #
# BBCode -> Markdown
# --------------------------------------------------------------------------- #
def bbcode_to_markdown(text: str) -> str:
    """Convert the subset of Steam BBCode used in announcements to Markdown."""
    if not text:
        return ""
    s = text.replace("\r\n", "\n").replace("{STEAM_CLAN_IMAGE}", STEAM_CLAN_IMAGE)

    # Embedded youtube preview -> plain link
    s = re.sub(
        r"\[previewyoutube=([^\];]+)(?:;[^\]]*)?\]\s*\[/previewyoutube\]",
        r"https://www.youtube.com/watch?v=\1",
        s,
        flags=re.I,
    )

    # Images and links
    s = re.sub(r"\[img\]\s*(.*?)\s*\[/img\]", r"![](\1)", s, flags=re.I | re.S)
    s = re.sub(r"\[url=([^\]]+)\](.*?)\[/url\]", r"[\2](\1)", s, flags=re.I | re.S)
    s = re.sub(r"\[url\](.*?)\[/url\]", r"\1", s, flags=re.I | re.S)

    # Headings
    for n in range(1, 7):
        s = re.sub(
            rf"\[h{n}\]\s*(.*?)\s*\[/h{n}\]",
            lambda m, n=n: f"\n{'#' * n} {m.group(1).strip()}\n",
            s,
            flags=re.I | re.S,
        )

    # Inline emphasis
    s = re.sub(r"\[b\](.*?)\[/b\]", r"**\1**", s, flags=re.I | re.S)
    s = re.sub(r"\[i\](.*?)\[/i\]", r"*\1*", s, flags=re.I | re.S)
    s = re.sub(r"\[u\](.*?)\[/u\]", r"<u>\1</u>", s, flags=re.I | re.S)
    s = re.sub(r"\[(?:strike|s)\](.*?)\[/(?:strike|s)\]", r"~~\1~~", s, flags=re.I | re.S)
    s = re.sub(r"\[spoiler\](.*?)\[/spoiler\]", r"\1", s, flags=re.I | re.S)

    # Block elements
    s = re.sub(r"\[code\](.*?)\[/code\]", lambda m: f"\n```\n{m.group(1).strip()}\n```\n", s, flags=re.I | re.S)
    s = re.sub(r"\[quote(?:=[^\]]+)?\]", "\n> ", s, flags=re.I)
    s = re.sub(r"\[/quote\]", "\n", s, flags=re.I)
    s = re.sub(r"\[hr\]\s*\[/hr\]", "\n\n---\n\n", s, flags=re.I)
    s = re.sub(r"\[/?hr\]", "\n\n---\n\n", s, flags=re.I)

    # Lists
    s = re.sub(r"\[/?(?:list|olist)\]", "\n", s, flags=re.I)
    s = re.sub(r"\[\*\]\s*", "\n- ", s, flags=re.I)

    # Anything left over (tables, unknown tags) -> drop the tag, keep inner text
    s = re.sub(r"\[/?[a-zA-Z][^\]]*\]", "", s)

    s = re.sub(r"[ \t]+\n", "\n", s)  # trailing whitespace
    s = re.sub(r"\n{3,}", "\n\n", s)  # collapse blank runs
    return s.strip()


# --------------------------------------------------------------------------- #
# File output
# --------------------------------------------------------------------------- #
def _frontmatter(item: dict, lang: str) -> dict:
    ts = item.get("date")
    date_iso = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None
    fm = {
        "gid": str(item.get("gid", "")),
        "title": item.get("title", ""),
        "date": date_iso,
        "author": item.get("author", ""),
        "url": item.get("url", ""),
        "language": lang,
        "feedlabel": item.get("feedlabel", ""),
        "feedname": item.get("feedname", ""),
        "appid": item.get("appid"),
    }
    if item.get("tags"):
        fm["tags"] = item["tags"]
    return fm


def write_item(item: dict, lang: str, outdir: Path) -> Path:
    """Write one news item to ./steam/<lang>/<gid>.md and return the path."""
    gid = str(item.get("gid", "")).strip() or "unknown"
    folder = outdir / lang
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{gid}.md"

    fm_yaml = yaml.safe_dump(
        _frontmatter(item, lang),
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    ).strip()
    body = bbcode_to_markdown(item.get("contents", ""))
    title = item.get("title", "").strip()

    path.write_text(f"---\n{fm_yaml}\n---\n\n# {title}\n\n{body}\n", encoding="utf-8")
    return path


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fetch Steam news and save as Markdown, grouped by detected language.")
    p.add_argument("--appid", default=DEFAULT_APPID, help=f"Steam app id (default: {DEFAULT_APPID})")
    p.add_argument("--count", type=int, default=DEFAULT_COUNT, help=f"Number of news items to fetch (default: {DEFAULT_COUNT})")
    p.add_argument("--output", default="./steam", help="Output root directory (default: ./steam)")
    p.add_argument("--lang", default=None, help="Only write items whose detected language equals this code (zh-tw or en)")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    outdir = Path(args.output)

    try:
        items = fetch_news(args.appid, args.count)
    except requests.RequestException as exc:
        print(f"error: failed to fetch Steam news: {exc}", file=sys.stderr)
        return 1

    if not items:
        print("No news items returned.", file=sys.stderr)
        return 0

    counts: Counter[str] = Counter()
    written = 0
    for item in items:
        lang = detect_language(item)
        if args.lang and lang != args.lang:
            continue
        path = write_item(item, lang, outdir)
        counts[lang] += 1
        written += 1
        print(f"  [{lang:>7}] {path}")

    print(f"\nWrote {written}/{len(items)} item(s) to {outdir.resolve()}")
    for lang, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {lang:>7}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
