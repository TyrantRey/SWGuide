"""OCR SoulWorker 靈魂小夥伴 故事 (soul-companion story / lore) screens through an
OpenAI-compatible vision endpoint.

Each story screen shows three tier tabs (S等級 / SS等級 / SSS等級, the selected one
highlighted gold), a blue title line, and the story body. This returns the
structured fields 名稱 / 等級 / 標題 / 故事 as JSON; anything unreadable or absent is
filled with "N/A".

Endpoint : https://llm.kurumi-tokisaki.com  (OpenAI-compatible, served at /v1)
Auth     : read from a .env file at the repo root (or any parent dir). Any of
           API_KEY / KURUMI_API_KEY / OPENAI_API_KEY works:

    # .env
    API_KEY=sk-...

    uv run tools/pet_story_ocr.py story.png
    uv run tools/pet_story_ocr.py tools/captures --save-dir tools/.ocr-cache/S級故事
    uv run tools/pet_story_ocr.py story.png --dry-run     # build the request, don't call
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from dotenv import find_dotenv, load_dotenv
from openai import OpenAI
from PIL import Image

if TYPE_CHECKING:
    from openai.types.chat import ChatCompletionMessageParam

# Load .env (searched from the cwd upward) before reading any config, so the key
# and optional overrides can live in the repo-root .env.
load_dotenv(find_dotenv(usecwd=True))

DEFAULT_BASE_URL = os.environ.get("KURUMI_BASE_URL", "https://llm.kurumi-tokisaki.com/v1")
DEFAULT_MODEL = os.environ.get("KURUMI_MODEL", "gpt-5.4")
DEFAULT_MAX_PX = int(os.environ.get("KURUMI_MAX_PX", "1536"))
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

# The endpoint sits behind Cloudflare, whose WAF blocks the openai SDK's default
# "OpenAI/Python" User-Agent (403 "Your request was blocked."). A browser UA passes.
USER_AGENT = os.environ.get(
    "KURUMI_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
)

NA = "N/A"
FIELDS = ["名稱", "等級", "標題", "故事"]

SYSTEM_PROMPT = """你是《靈魂行者》(SoulWorker)「靈魂小夥伴」故事(劇情)頁的 OCR 助手。\
辨識使用者提供的故事截圖，只輸出「一個」JSON 物件，不要附加任何說明文字或 markdown 圍欄。

截圖右上角有三個分頁標籤：「S等級」「SS等級」「SSS等級」，其中「被選取」的那個會以\
黃色／亮色高亮，其餘為灰色。標籤下方有一行「藍色標題」，再下面是整段故事(對話)內文。

輸出欄位與規則（鍵名需完全相同）：
名稱: string，這隻靈魂小夥伴的名字。只有在內文裡說話者明確自我介紹\
（例如「我叫做○○」「本姑娘就是○○」）或明確點名是「誰」的故事時才填那個名字；\
否則填 "N/A"。
等級: string，被高亮(黃色)的那個分頁，只能是 "S"、"SS" 或 "SSS"。無法判斷填 "N/A"。
標題: string，標籤下方那行藍色標題（不含內文）。無法辨識填 "N/A"。
故事: string，故事內文全文，原本的換行用空格代替，保留原文。無法辨識填 "N/A"。

輸出格式範例：
{"名稱": "洛革曼", "等級": "S", "標題": "情報之星", "故事": "沒錯，本姑娘就是四星三林的洛革曼！…"}
任何無法辨識或不存在的欄位一律填 "N/A"。"""

USER_TEXT = "OCR 這張靈魂小夥伴故事截圖，依系統指示輸出 JSON。"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def make_client(base_url: str, api_key: str | None) -> OpenAI:
    key = (
        api_key
        or os.environ.get("KURUMI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("API_KEY")
    )
    if not key:
        sys.exit("error: no API key. Put API_KEY=... in .env, or pass --api-key.")
    return OpenAI(base_url=base_url, api_key=key, default_headers={"User-Agent": USER_AGENT})


def prepare_image(path: Path, max_px: int = DEFAULT_MAX_PX) -> str:
    """Downscale + JPEG-encode a local image into a base64 data URL.

    Screens are flattened to RGB, the longest side capped at max_px (keeps text
    legible while shrinking the payload), and emitted as JPEG to keep the request
    small and fast.
    """
    im = Image.open(path)
    if im.mode != "RGB":
        im = im.convert("RGB")
    if max(im.size) > max_px:
        im.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def collect_images(inputs: list[str]) -> list[Path]:
    """Expand files and directories into a sorted list of image paths."""
    out: list[Path] = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            out += [f for f in sorted(p.rglob("*")) if f.suffix.lower() in IMAGE_EXTS]
        elif p.is_file():
            out.append(p)
        else:
            print(f"warning: not found, skipping: {p}", file=sys.stderr)
    return out


def _na(v: object) -> str:
    """Coerce a value to a stripped string, defaulting blanks to 'N/A'."""
    s = str(v if v is not None else "").strip()
    return s if s else NA


def _norm_level(v: object) -> str:
    """Normalize the tier to exactly 'S' / 'SS' / 'SSS', else 'N/A'."""
    s = re.sub(r"[等级級\s]", "", str(v or "").strip().upper())
    if re.fullmatch(r"S{1,3}", s):
        return s
    for cand in ("SSS", "SS", "S"):  # longest first so 'SSS等級' → 'SSS'
        if cand in s:
            return cand
    return NA


def parse_json_object(text: str) -> dict:
    """Parse the model's reply into a dict, tolerating code fences / stray prose."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        i, j = t.find("{"), t.rfind("}")
        if i != -1 and j > i:
            return json.loads(t[i : j + 1])
        raise


def normalize(data: dict) -> dict:
    """Keep exactly FIELDS as strings; 等級 constrained to S/SS/SSS; blanks → 'N/A'."""
    return {
        "名稱": _na(data.get("名稱")),
        "等級": _norm_level(data.get("等級")),
        "標題": _na(data.get("標題")),
        "故事": _na(data.get("故事")),
    }


# --------------------------------------------------------------------------- #
# OCR
# --------------------------------------------------------------------------- #
def ocr_story(client: OpenAI, model: str, path: Path, max_px: int = DEFAULT_MAX_PX) -> dict:
    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": USER_TEXT},
                {"type": "image_url", "image_url": {"url": prepare_image(path, max_px)}},
            ],
        },
    ]
    # Prefer JSON mode; some upstream models reject response_format, so fall back.
    try:
        resp = client.chat.completions.create(
            model=model, temperature=0, response_format={"type": "json_object"}, messages=messages
        )
    except Exception:
        resp = client.chat.completions.create(model=model, temperature=0, messages=messages)
    return normalize(parse_json_object(resp.choices[0].message.content or ""))


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="OCR SoulWorker 靈魂小夥伴 故事 screens via an OpenAI-compatible vision endpoint.")
    p.add_argument("images", nargs="*", help="Image file(s) or folder(s) of 靈魂小夥伴 story screenshots.")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Vision model id (default: {DEFAULT_MODEL}).")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"OpenAI-compatible base URL (default: {DEFAULT_BASE_URL}).")
    p.add_argument("--api-key", default=None, help="API key (overrides API_KEY / KURUMI_API_KEY / OPENAI_API_KEY from env/.env).")
    p.add_argument("--save-dir", default=None, help="Write one <name>.json per image into this directory.")
    p.add_argument("--skip-existing", action="store_true", help="With --save-dir, skip images that already have a <name>.json (don't re-OCR).")
    p.add_argument("--max-px", type=int, default=DEFAULT_MAX_PX, help=f"Downscale longest image side to at most this (default: {DEFAULT_MAX_PX}).")
    p.add_argument("--list-models", action="store_true", help="List model ids your token can use, then exit.")
    p.add_argument("--dry-run", action="store_true", help="Build the request and report it without calling the API.")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    # Force UTF-8 stdout/stderr so printing CJK JSON never dies on a legacy
    # console codepage (Windows cp950 crashed the detached batch run otherwise).
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            try:
                stream.reconfigure(encoding="utf-8")
            except ValueError:
                pass
    args = parse_args(argv)

    if args.list_models:
        client = make_client(args.base_url, args.api_key)
        for m in sorted(client.models.list().data, key=lambda x: x.id):
            print(m.id)
        return 0

    images = collect_images(args.images)
    if not images:
        print("error: no images given. Pass image file(s) or a folder.", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"base_url : {args.base_url}")
        print(f"model    : {args.model}")
        print(f"images   : {len(images)}")
        for img in images:
            print(f"  - {img}  ({len(prepare_image(img, args.max_px))} b64 chars @ max {args.max_px}px)")
        print("\n[dry-run] no API call made.")
        return 0

    client = make_client(args.base_url, args.api_key)
    save_dir = Path(args.save_dir) if args.save_dir else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    failures = skipped = 0
    for img in images:
        if save_dir and args.skip_existing and (save_dir / f"{img.stem}.json").exists():
            skipped += 1
            continue
        try:
            story = ocr_story(client, args.model, img, args.max_px)
        except Exception as exc:  # noqa: BLE001 - one bad image shouldn't stop the batch
            failures += 1
            print(f"error: {img}: {exc}", file=sys.stderr)
            continue

        record = {"file": img.name, **story}
        print(json.dumps(record, ensure_ascii=False, indent=2))
        if save_dir:
            (save_dir / f"{img.stem}.json").write_text(
                json.dumps(story, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )

    done = len(images) - skipped - failures
    print(f"\nOCR'd {done}, skipped {skipped} (cached), failed {failures} of {len(images)}.", file=sys.stderr)
    return 1 if failures and done == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
