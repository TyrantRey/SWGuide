import Link from "next/link";
import type { PostMeta } from "@/lib/content";
import { withBase } from "@/lib/site";
import { encodePath } from "@/lib/urlize";

export interface QuickStartItem {
  post: PostMeta;
  /** English HUD flavour label for the step. */
  en: string;
}

/**
 * 快速開始 — three wide onboarding cards (前言 / 入坑前 / 新手入坑)
 * with cover art, ghost step number and summary.
 */
export default function QuickStart({ items }: { items: QuickStartItem[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {items.map(({ post, en }, i) => {
        const step = String(i + 1).padStart(2, "0");
        return (
          <article key={post.slug} className="panel group">
            <Link href={post.url} className="flex h-full flex-col">
              <span className="relative block h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={withBase(encodePath(post.cover))}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-liner-to-t from-[rgba(17,26,46,0.92)] via-[rgba(17,26,46,0.3)] to-transparent"
                />
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 right-3 font-display text-5xl font-bold leading-none text-cyan/25 transition-colors duration-300 group-hover:text-cyan/45"
                >
                  {step}
                </span>
              </span>

              <span className="flex flex-1 flex-col gap-2 p-5">
                <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-cyan">
                  Step {step} · {en}
                </span>
                <span className="text-lg font-bold text-ink transition-colors group-hover:text-cyan">
                  {post.title}
                </span>
                {post.summary ? (
                  <span className="line-clamp-3 text-sm leading-relaxed text-ink-faint">
                    {post.summary}
                  </span>
                ) : null}
                <span className="mt-auto pt-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-ink-dim transition-colors group-hover:text-cyan">
                  閱讀指南 Read ▸
                </span>
              </span>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
