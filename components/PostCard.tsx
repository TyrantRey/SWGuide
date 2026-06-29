import Link from "next/link";
import type { PostMeta } from "@/lib/content";
import { withBase } from "@/lib/site";
import { encodePath } from "@/lib/urlize";
import { formatDate } from "@/lib/format";

/**
 * Shared post card: angular panel with cover, category capsules, title,
 * summary and reading stats. Used on home / archives / taxonomy pages.
 */
export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="panel group">
      <Link href={post.url} className="flex items-stretch gap-0">
        <span className="relative block w-42 shrink-0 self-stretch overflow-hidden max-sm:w-27">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(encodePath(post.cover))}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <span
            className="absolute inset-0 bg-liner-to-r from-transparent to-[rgba(17,26,46,0.85)]"
            aria-hidden="true"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
          <span className="flex flex-wrap items-center gap-2">
            {post.categories.map((c) => (
              <span key={c} className="capsule text-[0.72rem]">
                {c}
              </span>
            ))}
            <time className="font-display text-xs font-semibold tracking-[0.2em] text-ink-faint">
              {formatDate(post.lastmod)}
            </time>
          </span>
          <span className="truncate text-lg font-bold text-ink transition-colors group-hover:text-cyan">
            {post.title}
          </span>
          {post.summary ? (
            <span className="line-clamp-2 text-sm leading-relaxed text-ink-faint">
              {post.summary}
            </span>
          ) : null}
          <span className="mt-auto pt-1 font-display text-[0.7rem] font-semibold tracking-[0.25em] text-ink-faint">
            {post.wordCount} 字
          </span>
        </span>
      </Link>
    </article>
  );
}
