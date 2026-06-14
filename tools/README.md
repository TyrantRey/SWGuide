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

## pet_ocr.py

OCRs SoulWorker **靈魂小夥伴** (soul-companion / pet) screenshots through the same
OpenAI-compatible vision endpoint as `ar_ocr.py`, returning the two fields the pet
panel shows.

```text
pet screenshot  ->  downscale + JPEG  ->  gpt-5.4 vision  ->  {靈魂小夥伴能力值, 靈魂小夥伴技能}
```

| Field          | Type                  | Rule                                                                                        |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `靈魂小夥伴能力值` | `list[dict[str, …]]`  | One single-key `{能力名稱: 數值}` object per stat. Plain ints lose commas (`2,100`→`2100`); values with a unit keep the string (`5.0%`). |
| `靈魂小夥伴技能`   | `string`              | Skill name + full description, joined by `：` (e.g. `情報之星 III：暴擊命中時…`).                  |

Same setup, auth (`.env`), flags, and Cloudflare-UA handling as `ar_ocr.py`
(`--model` / `--save-dir` / `--skip-existing` / `--max-px` / `--dry-run` / `--list-models`).

```bash
uv run tools/pet_ocr.py pet.png                                          # prints one JSON object
uv run tools/pet_ocr.py "content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴" --save-dir "tools/.ocr-cache/S級"
uv run tools/pet_ocr.py pet.png --dry-run                                # build request, no API call
```

> Note: untranslated new content shows up in Korean in-game; the OCR captures that
> verbatim (it is the real on-screen text), so the occasional Korean skill row is
> expected — curate by hand if/when it gets a zh-TW string.

## build_pet_md.py

Aggregates the per-image JSONs from `pet_ocr.py --save-dir` into one Markdown table
(`圖 | 能力值 | 技能`), ready to splice into `<級>級靈魂小夥伴.md`.

```bash
uv run tools/build_pet_md.py tools/.ocr-cache/S級                       # text-only table
uv run tools/build_pet_md.py tools/.ocr-cache/S級 --img-dir "content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴"
```

Renders each pet's `能力值` list inline (`name val；name val`, thousands separators
re-added), collapses exact-duplicate rows (NFKC-normalized), and sorts by skill name.
Pure-stdlib (no deps). With `--img-dir` it prepends a `圖` thumbnail column and **skips
orphaned cache entries** whose source image was deleted, so the page never carries a
broken ref.

### 靈魂小夥伴 pipeline (how the S-rank page was built)

```bash
# 1. OCR every screenshot into a per-pet JSON cache (idempotent across runs)
uv run tools/pet_ocr.py "content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴" \
    --save-dir "tools/.ocr-cache/S級" --skip-existing
# 2. Aggregate the cache into a Markdown table (with thumbnails)
uv run tools/build_pet_md.py "tools/.ocr-cache/S級" --img-dir "content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴"
# 3. Splice the table under '## 靈魂小夥伴' in content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴.md
```

The same flow works for `A 級` / `B 級` / `C 級` — just point at that pet folder and cache dir.

## pet_story_ocr.py

OCRs SoulWorker **靈魂小夥伴 故事** (soul-companion story / lore) screens. Each screen
has three tier tabs (`S等級` / `SS等級` / `SSS等級`, the selected one highlighted gold),
a blue title, and the story body.

```text
story screen  ->  downscale + JPEG  ->  gpt-5.4 vision  ->  {名稱, 等級, 標題, 故事}
```

| Field  | Type   | Rule                                                                                  |
| ------ | ------ | ------------------------------------------------------------------------------------- |
| `名稱` | string | Pet name **only if** the body self-identifies it (e.g. `我叫做○○`); else `N/A`.        |
| `等級` | string | The highlighted tab, constrained to `S` / `SS` / `SSS`; else `N/A`.                   |
| `標題` | string | The blue title line.                                                                  |
| `故事` | string | The full story body (newlines → spaces).                                              |

Anything the model can't read is `N/A`. Same `.env` auth / flags / Cloudflare-UA as
`ar_ocr.py`. **Note:** the `名稱` OCR is unreliable (the lore body often names other
characters, not the pet), so the build step below takes pet names from `--names`
instead — don't trust `名稱` for mapping.

```bash
uv run tools/pet_story_ocr.py tools/captures --save-dir "tools/.ocr-cache/S級故事"
```

## build_pet_story_md.py

Aggregates the per-screen JSONs into a `名稱 | S | SS | SSS` table, ready to splice
under `### 故事` in `<級>級靈魂小夥伴.md`. Pure-stdlib (no deps).

```bash
uv run tools/build_pet_story_md.py tools/.ocr-cache/S級故事 \
    --names "洛革曼,毒魔,奈夫,米莉亞姆,貝蒂,阿魯卡,綠風魔女" \
    --roster "洛革曼,奈夫,米莉亞姆,毒魔,尤爾卡哈,阿魯卡,凱薩林,貝蒂,索爾 巴得凱,拉姆蕾薩爾,寶蓮"
```

Screens are read in filename (= capture) order and grouped into pets: a **new pet
starts at each `S`-tier screen**, and the following `SS` / `SSS` screens fill that
pet's row. Each tier cell becomes `**標題**：故事`; any tier with no screen — or any
field the OCR couldn't read — is left as `N/A`.

| Flag       | Meaning                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--names`  | Comma-separated pet names labelling the groups **in capture order** (overrides the unreliable `名稱` OCR — this is the trusted source). |
| `--roster` | Comma-separated full pet roster; emit one row per roster pet in that order, `N/A` for pets with no captured story. Groups not in the roster are appended and reported on stderr (nothing captured is dropped). |

### 靈魂小夥伴 故事 pipeline (how the S-rank 故事 table was built)

```bash
# 1. OCR every story screen into a per-screen JSON cache (idempotent across runs)
uv run tools/pet_story_ocr.py tools/captures \
    --save-dir "tools/.ocr-cache/S級故事" --skip-existing
# 2. Aggregate into a roster-ordered table (names from --names, full roster from --roster)
uv run tools/build_pet_story_md.py "tools/.ocr-cache/S級故事" --names "…" --roster "…"
# 3. Splice the table under '### 故事' in content/post/系統/靈魂小夥伴篇/S 級靈魂小夥伴.md
```

The OCR keeps the in-game text verbatim (minor recognition slips and Korean-only
untranslated screens included), so curate by hand afterwards as needed.

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
