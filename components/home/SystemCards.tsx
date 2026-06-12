import Link from "next/link";
import type { PostMeta } from "@/lib/content";

export interface SystemCardItem {
  /** The directory post the card links to. */
  post: PostMeta;
  /** zh-TW display title. */
  zh: string;
  /** English HUD label. */
  en: string;
  /** Number of guides under this sub-folder (directory post excluded). */
  count: number;
}

/**
 * 系統 — one featured overview card spanning the row, then four
 * sub-system directory cards (equipment / medals / AR cards / soul pets),
 * each with an English HUD label, summary and entry count.
 */
export default function SystemCards({
  overview,
  items,
}: {
  overview?: SystemCardItem;
  items: SystemCardItem[];
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {overview ? (
        <article className="panel group sm:col-span-2 lg:col-span-4">
          <Link
            href={overview.post.url}
            className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center md:p-8"
          >
            <span className="min-w-0 flex-1">
              <span className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-cyan">
                System Overview
              </span>
              <span className="mt-1 block text-2xl font-bold text-ink transition-colors group-hover:text-cyan">
                {overview.zh}
              </span>
              {overview.post.summary ? (
                <span className="mt-2 line-clamp-2 block max-w-2xl text-sm leading-relaxed text-ink-faint">
                  {overview.post.summary}
                </span>
              ) : null}
            </span>

            <span className="flex shrink-0 items-center gap-6 sm:flex-col sm:items-end sm:gap-1">
              <span className="flex items-baseline gap-2">
                <span className="neon-text font-display text-4xl font-bold leading-none">
                  {overview.count}
                </span>
                <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-ink-faint">
                  Entries
                </span>
              </span>
              <span className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.25em] text-ink-dim transition-colors group-hover:text-cyan">
                進入總覽 Enter ▸
              </span>
            </span>
          </Link>
        </article>
      ) : null}

      {items.map((item) => (
        <article key={item.post.slug} className="panel group">
          <Link href={item.post.url} className="flex h-full flex-col gap-2.5 p-5">
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-cyan">
                {item.en}
              </span>
              <span className="font-display text-xs tracking-[0.15em] text-ink-faint">
                <span className="font-bold text-magenta">{item.count}</span> 篇
              </span>
            </span>

            <span className="text-xl font-bold text-ink transition-colors group-hover:text-cyan">
              {item.zh}
            </span>

            {item.post.summary ? (
              <span className="line-clamp-2 text-sm leading-relaxed text-ink-faint">
                {item.post.summary}
              </span>
            ) : null}

            <span className="mt-auto pt-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-ink-dim transition-colors group-hover:text-cyan">
              進入分區 Enter ▸
            </span>
          </Link>
        </article>
      ))}
    </div>
  );
}
