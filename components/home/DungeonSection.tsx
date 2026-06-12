import Link from "next/link";
import type { PostMeta } from "@/lib/content";
import { withBase } from "@/lib/site";
import { encodePath } from "@/lib/urlize";
import { formatDate } from "@/lib/format";

/**
 * 副本 — full-bleed lead card for 副本篇 next to a compact grid of the
 * main raid dungeons (cover strip + title + date).
 */
export default function DungeonSection({
  lead,
  dungeons,
}: {
  lead: PostMeta;
  dungeons: PostMeta[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* lead card */}
      <article className="panel group relative min-h-[300px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(encodePath(lead.cover))}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[rgba(7,10,18,0.95)] via-[rgba(7,10,18,0.5)] to-[rgba(7,10,18,0.2)]"
        />
        <Link
          href={lead.url}
          className="relative flex h-full min-h-[300px] flex-col justify-end gap-2 p-6"
        >
          <span className="hud-chip">Raid Guide</span>
          <span className="text-2xl font-bold text-ink transition-colors group-hover:text-cyan">
            {lead.title}
          </span>
          {lead.summary ? (
            <span className="line-clamp-2 text-sm leading-relaxed text-ink-dim">
              {lead.summary}
            </span>
          ) : null}
          <span className="mt-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.25em] text-cyan">
            進入副本篇 Enter ▸
          </span>
        </Link>
      </article>

      {/* compact dungeon grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {dungeons.map((d) => (
          <Link key={d.slug} href={d.url} className="panel group flex flex-col">
            <span className="relative block h-20 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase(encodePath(d.cover))}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[rgba(17,26,46,0.9)] to-transparent"
              />
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="truncate text-sm font-bold text-ink transition-colors group-hover:text-cyan">
                {d.title}
              </span>
              <time className="font-display text-[0.65rem] font-semibold tracking-[0.2em] text-ink-faint">
                {formatDate(d.date)}
              </time>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
