"""OCR SoulWorker 靈魂小夥伴 (soul-companion / pet) cards through an
OpenAI-compatible vision endpoint.

Sends each pet screenshot to a vision model and returns the structured fields
靈魂小夥伴能力值 (a list of {能力名稱: 數值} objects) and 靈魂小夥伴技能
(the skill name + description as one string).

Endpoint : https://llm.kurumi-tokisaki.com  (OpenAI-compatible, served at /v1)
Auth     : read from a .env file at the repo root (or any parent dir). Any of
           API_KEY / KURUMI_API_KEY / OPENAI_API_KEY works:

    # .env
    API_KEY=sk-...

    uv run tools/pet_ocr.py pet.png
    uv run tools/pet_ocr.py ./pets/ --save-dir ./pet-cards
    uv run tools/pet_ocr.py pet.png --model gpt-5.4
    uv run tools/pet_ocr.py pet.png --dry-run     # build the request, don't call
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

DEFAULT_BASE_URL = os.environ.get(
    "KURUMI_BASE_URL", "https://llm.kurumi-tokisaki.com/v1"
)
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

FIELDS = ["靈魂小夥伴能力值", "靈魂小夥伴技能"]

SYSTEM_PROMPT = """你是《靈魂行者》(SoulWorker)「靈魂小夥伴」(寵物) 的 OCR 助手。\
辨識使用者提供的靈魂小夥伴資訊截圖，只輸出「一個」JSON 物件，不要附加任何說明文字或 markdown 圍欄。

截圖包含兩個區塊：
1.「靈魂小夥伴能力值」：若干列「能力名稱 → 數值」（一列可能有一到兩組）。
2.「靈魂小夥伴技能」：一個技能名稱（通常結尾帶 I／II／III）與其完整描述。

輸出欄位與規則（鍵名需完全相同）：
靈魂小夥伴能力值: list。陣列中每個元素是一個「只有單一鍵值對」的物件 {"能力名稱": 數值}，\
依畫面由上到下、由左到右排列。
  - 數值為純整數時（如 2,100 / 1,440 / 180），去掉千分位逗號後填整數，例如 2100。
  - 數值帶單位時（百分比如 5.0%、2.0%、3.0%），保留含單位的原字串。
靈魂小夥伴技能: string，技能名稱接著完整描述，中間用全形冒號「：」分隔，\
例如「情報之星 III：晷擊命中時附加傷害…」。保留原文，原本的換行用空格代替。

輸出格式範例：
{"靈魂小夥伴能力值": [{"攻擊力": 1420}, {"命中度": 180}, {"攻擊速度【%】": "5.0%"}], \
"靈魂小夥伴技能": "冷靜 III：靈魂值未滿10%時，命中時靈魂值恢復30%…"}
無法辨識的欄位：list 填 []、string 填 ""。"""

USER_TEXT = "OCR 這張靈魂小夥伴截圖，依系統指示輸出 JSON。"


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
    return OpenAI(
        base_url=base_url, api_key=key, default_headers={"User-Agent": USER_AGENT}
    )


def prepare_image(path: Path, max_px: int = DEFAULT_MAX_PX) -> str:
    """Downscale + JPEG-encode a local image into a base64 data URL.

    Cards are screenshots, so we flatten to RGB, cap the longest side at max_px
    (keeps text legible while shrinking the payload), and emit JPEG to keep the
    request small and fast.
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


def _coerce_value(v: object) -> object:
    """A stat value: a plain integer (commas stripped) stays an int; anything
    carrying a unit (5.0% / 3.0%) keeps its displayed string so '%' survives."""
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        s = v.strip()
        if re.fullmatch(r"-?[\d,]+", s):
            return int(s.replace(",", ""))
        return s
    return v


def _normalize_stats(raw: object) -> list[dict]:
    """Coerce the 能力值 block into a list of single-key {能力名稱: 數值} dicts,
    tolerating a plain {name: val, ...} dict or {名稱, 數值} object rows."""
    out: list[dict] = []

    def add(name: object, val: object) -> None:
        name = str(name or "").strip()
        if name:
            out.append({name: _coerce_value(val)})

    if isinstance(raw, dict):
        for k, v in raw.items():
            add(k, v)
    elif isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            # {"名稱": "攻擊力", "數值": 1420} style
            name_key = next((k for k in ("名稱", "名字", "name") if k in item), None)
            val_key = next((k for k in ("數值", "值", "value") if k in item), None)
            if name_key and val_key:
                add(item[name_key], item[val_key])
            else:
                for k, v in item.items():
                    add(k, v)
    return out


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
    """Keep exactly FIELDS: 能力值 as a list of single-key dicts, 技能 as a string."""
    return {
        "靈魂小夥伴能力值": _normalize_stats(data.get("靈魂小夥伴能力值")),
        "靈魂小夥伴技能": str(data.get("靈魂小夥伴技能") or "").strip(),
    }


# --------------------------------------------------------------------------- #
# OCR
# --------------------------------------------------------------------------- #
def ocr_pet(
    client: OpenAI, model: str, path: Path, max_px: int = DEFAULT_MAX_PX
) -> dict:
    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": USER_TEXT},
                {
                    "type": "image_url",
                    "image_url": {"url": prepare_image(path, max_px)},
                },
            ],
        },
    ]
    # Prefer JSON mode; some upstream models reject response_format, so fall back.
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=messages,
        )
    except Exception:
        resp = client.chat.completions.create(
            model=model, temperature=0, messages=messages
        )
    return normalize(parse_json_object(resp.choices[0].message.content or ""))


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="OCR SoulWorker 靈魂小夥伴 cards via an OpenAI-compatible vision endpoint."
    )
    p.add_argument(
        "images",
        nargs="*",
        help="Image file(s) or folder(s) of 靈魂小夥伴 screenshots.",
    )
    p.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Vision model id (default: {DEFAULT_MODEL}).",
    )
    p.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"OpenAI-compatible base URL (default: {DEFAULT_BASE_URL}).",
    )
    p.add_argument(
        "--api-key",
        default=None,
        help="API key (overrides API_KEY / KURUMI_API_KEY / OPENAI_API_KEY from env/.env).",
    )
    p.add_argument(
        "--save-dir",
        default=None,
        help="Write one <name>.json per image into this directory.",
    )
    p.add_argument(
        "--skip-existing",
        action="store_true",
        help="With --save-dir, skip images that already have a <name>.json (don't re-OCR).",
    )
    p.add_argument(
        "--max-px",
        type=int,
        default=DEFAULT_MAX_PX,
        help=f"Downscale longest image side to at most this (default: {DEFAULT_MAX_PX}).",
    )
    p.add_argument(
        "--list-models",
        action="store_true",
        help="List model ids your token can use, then exit.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the request and report it without calling the API.",
    )
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
        print(
            "error: no images given. Pass image file(s) or a folder.", file=sys.stderr
        )
        return 1

    if args.dry_run:
        print(f"base_url : {args.base_url}")
        print(f"model    : {args.model}")
        print(f"images   : {len(images)}")
        for img in images:
            print(
                f"  - {img}  ({len(prepare_image(img, args.max_px))} b64 chars @ max {args.max_px}px)"
            )
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
            pet = ocr_pet(client, args.model, img, args.max_px)
        except Exception as exc:  # noqa: BLE001 - one bad image shouldn't stop the batch
            failures += 1
            print(f"error: {img}: {exc}", file=sys.stderr)
            continue

        record = {"file": img.name, **pet}
        print(json.dumps(record, ensure_ascii=False, indent=2))
        if save_dir:
            (save_dir / f"{img.stem}.json").write_text(
                json.dumps(pet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )

    done = len(images) - skipped - failures
    print(
        f"\nOCR'd {done}, skipped {skipped} (cached), failed {failures} of {len(images)}.",
        file=sys.stderr,
    )
    return 1 if failures and done == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
