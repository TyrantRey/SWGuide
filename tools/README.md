# tools

Standalone Python utilities for this repo. Managed with [uv](https://docs.astral.sh/uv/) —
each script declares its dependencies inline (PEP 723), so there is **no** `pip install`,
`requirements.txt`, or virtualenv to manage. `uv run` resolves and caches the deps the
first time you run it.

## steam_news.py

Fetches Steam news / announcements for an app and writes one Markdown file per item,
grouped by detected language.

```text
Steam ISteamNews API  ->  detect language (title)  ->  YAML frontmatter + BBCode→Markdown
                                                    ->  ./steam/{language}/{gid}.md
```

This feed only publishes English and Traditional Chinese, so detection is a
deterministic **Unicode-script test on the title**: a title carrying Han characters
is `zh-tw`, everything else is `en`. A statistical detector like `langdetect` is
unreliable on titles this short — it tags English titles as `af`/`nl`/`de` and
Traditional Chinese as Korean — so it is intentionally not used.

### Usage

Run from the repo root (so `./steam` lands at the repo root):

```bash
uv run tools/steam_news.py                      # appid 1377580 (SoulWorker), 100 items
uv run tools/steam_news.py --count 50
uv run tools/steam_news.py --lang zh-tw         # only Traditional-Chinese items
uv run tools/steam_news.py --appid 730 --output ./steam
```

| Flag       | Default   | Meaning                                                    |
| ---------- | --------- | ---------------------------------------------------------- |
| `--appid`  | `1377580` | Steam app id.                                              |
| `--count`  | `100`     | How many news items to request.                            |
| `--output` | `./steam` | Output root; files go to `<output>/<language>/<gid>.md`.   |
| `--lang`   | _(all)_   | Only write items whose detected language equals this code. |

### Output

- `{language}` is `en` or `zh-tw` (see the detection note above).
- `{gid}` is Steam's globally-unique news id, so re-running overwrites the same file
  in place rather than producing duplicates.
- Each file has YAML frontmatter (`gid`, `title`, `date`, `author`, `url`, `language`,
  `feedlabel`, `feedname`, `appid`, optional `tags`) followed by the announcement body
  with Steam BBCode (`[img]`, `[url]`, `[b]`, `[h1]`, lists, quotes, …) converted to
  Markdown and `{STEAM_CLAN_IMAGE}` rewritten to Steam's CDN host.

## ar_ocr.py

OCRs SoulWorker **AR-card** images through an OpenAI-compatible vision endpoint and
returns the structured fields as JSON.

```text
AR-card image  ->  downscale + JPEG  ->  gpt-5.4 vision  ->  {卡名 星數 等級 稀有度 類型 能力名字 能力描述}
```

| Field      | Type   | Rule                                                                 |
| ---------- | ------ | -------------------------------------------------------------------- |
| `卡名`     | string | Card name.                                                           |
| `星數`     | int    | Number of stars.                                                     |
| `等級`     | int    | Enhancement level, `0`/`1`/`2` (the `+0`/`+1`/`+2` badge).           |
| `稀有度`   | string | By star **colour**: `神秘`=purple, `隱藏`=light-blue, `一般`=yellow. |
| `類型`     | string | `主動` (active) / `被動` (passive) / `核心` (core).                  |
| `能力名字` | string | Ability name.                                                        |
| `能力描述` | string | Ability description.                                                 |

### Setup

The endpoint `https://llm.kurumi-tokisaki.com/v1` needs a token. Put it in a `.env`
at the repo root (already git-ignored):

```text
API_KEY=sk-...
```

Any of `API_KEY` / `KURUMI_API_KEY` / `OPENAI_API_KEY` is accepted. Optional overrides:
`KURUMI_MODEL`, `KURUMI_BASE_URL`, `KURUMI_MAX_PX`, `KURUMI_USER_AGENT`.

### Usage

```bash
uv run tools/ar_ocr.py card.png                              # prints one JSON object
uv run tools/ar_ocr.py "content/post/系統/AR卡篇/1星AR卡" --save-dir ./ar-cards
uv run tools/ar_ocr.py card.png --model gpt-5.4 --max-px 1536
uv run tools/ar_ocr.py card.png --dry-run                    # build request, no API call
```

| Flag              | Default                   | Meaning                                                                                      |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `images`          | —                         | Image file(s) or folder(s) of AR-card images.                                                |
| `--model`         | `gpt-5.4`                 | Vision model id.                                                                             |
| `--base-url`      | `…kurumi-tokisaki.com/v1` | OpenAI-compatible base URL.                                                                  |
| `--api-key`       | _(from env/.env)_         | Override the key.                                                                            |
| `--save-dir`      | _(none)_                  | Write one `<name>.json` per image here.                                                      |
| `--skip-existing` | —                         | With `--save-dir`, skip images that already have a `<name>.json` (don't re-OCR / re-charge). |
| `--max-px`        | `1536`                    | Cap the longest image side before sending.                                                   |
| `--list-models`   | —                         | List models your token can use (may be blocked).                                             |
| `--dry-run`       | —                         | Report the request without calling the API.                                                  |

### Notes

- **gpt-5.4** is the working vision model on this gateway (most OpenAI/Claude/Gemini
  model names return `無可用管道`). `gemini-2.5-flash` also works.
- The endpoint is behind **Cloudflare**, whose WAF blocks the openai SDK's default
  `User-Agent: OpenAI/Python` (`403 Your request was blocked.`). The tool sends a
  browser User-Agent so requests get through — override with `KURUMI_USER_AGENT`.
- Images are flattened to RGB, capped at `--max-px`, and JPEG-encoded to keep the
  request small; `int` fields are coerced (e.g. `"+2"` → `2`) and the reply is parsed
  even if the model wraps it in a ```` ```json ```` fence.

## build_ar_md.py

Aggregates the per-image JSONs from `ar_ocr.py --save-dir` into a Markdown card
section grouped by 類型, ready to splice into `<N>星AR卡.md`.

```bash
uv run tools/build_ar_md.py tools/.ocr-cache/1星                       # text-only tables
uv run tools/build_ar_md.py tools/.ocr-cache/1星 --img-dir "content/post/系統/AR卡篇/1星AR卡"
```

Collapses duplicate rows (NFKC-normalized, so full-width vs half-width parens/numerals
fold together), sorts by 卡名 then 等級, and emits a `卡名 | 等級 | 稀有度 | 能力 | 效果`
table per 主動 / 被動 / 核心 group. Pure-stdlib (no deps). With `--img-dir` it prepends a
`圖` column of card thumbnails (`![image](file-….png)`) and **skips orphaned cache entries**
whose source image has since been deleted, so the page never carries a broken ref.

### AR-card pipeline (how the 1-star page was built)

```bash
# 1. OCR every screenshot into a per-card JSON cache (idempotent across runs)
uv run tools/ar_ocr.py "content/post/系統/AR卡篇/1星AR卡" \
    --save-dir "tools/.ocr-cache/1星" --skip-existing
# 2. Aggregate the cache into grouped Markdown tables (with card thumbnails)
uv run tools/build_ar_md.py "tools/.ocr-cache/1星" --img-dir "content/post/系統/AR卡篇/1星AR卡"
# 3. Splice the tables into content/post/系統/AR卡篇/1星AR卡.md
```

`tools/.ocr-cache/` is git-ignored; re-running step 1 only OCRs newly-added images.
The same flow works for `2星AR卡` … `5星AR卡` / `神秘AR卡` — just point at that folder.

## snip.py

Region screenshot tool for fast card capturing (Windows). Drag-select a region
once, then press **ENTER** to snap it repeatedly — each save is named the Obsidian
way (`file-<timestamp>.png`) so it drops straight into a card folder, ready for
`ar_ocr.py`.

```bash
uv run tools/snip.py                                    # save to ./captures
uv run tools/snip.py -o "content/post/系統/AR卡篇/2星AR卡"
```

| Key       | Action                           |
| --------- | -------------------------------- |
| drag      | select the capture region        |
| **ENTER** | capture the region + save (beep) |
| **R**     | re-select the region             |
| **ESC/Q** | quit                             |

The keys are **global**, so you keep the game focused: change the card in-game,
press ENTER to snap, repeat. DPI-aware and multi-monitor aware (uses the full
virtual desktop). `-o` defaults to `./captures`; `--no-beep` silences the feedback.
Then OCR what you captured with the `ar_ocr.py` → `build_ar_md.py` pipeline above.
