# tools

Standalone Python utilities for this repo. Managed with [uv](https://docs.astral.sh/uv/) —
each script declares its dependencies inline (PEP 723), so there is **no** `pip install`,
`requirements.txt`, or virtualenv to manage. `uv run` resolves and caches the deps the
first time you run it.

## steam_news.py

Fetches Steam news / announcements for an app and writes one Markdown file per item,
grouped by detected language.

```
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

| Flag       | Default      | Meaning                                                         |
| ---------- | ------------ | --------------------------------------------------------------- |
| `--appid`  | `1377580`    | Steam app id.                                                   |
| `--count`  | `100`        | How many news items to request.                                 |
| `--output` | `./steam`    | Output root; files go to `<output>/<language>/<gid>.md`.        |
| `--lang`   | _(all)_      | Only write items whose detected language equals this code.      |

### Output

- `{language}` is `en` or `zh-tw` (see the detection note above).
- `{gid}` is Steam's globally-unique news id, so re-running overwrites the same file
  in place rather than producing duplicates.
- Each file has YAML frontmatter (`gid`, `title`, `date`, `author`, `url`, `language`,
  `feedlabel`, `feedname`, `appid`, optional `tags`) followed by the announcement body
  with Steam BBCode (`[img]`, `[url]`, `[b]`, `[h1]`, lists, quotes, …) converted to
  Markdown and `{STEAM_CLAN_IMAGE}` rewritten to Steam's CDN host.
