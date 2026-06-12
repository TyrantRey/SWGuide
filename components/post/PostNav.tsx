import Link from "next/link";
import type { PostMeta } from "@/lib/content";
import { withBase } from "@/lib/site";
import { encodePath } from "@/lib/urlize";

interface PostNavProps {
  prev?: PostMeta;
  next?: PostMeta;
}

interface NavCardProps {
  post?: PostMeta;
  label: string;
  align: "left" | "right";
}

function NavCard({ post, label, align }: NavCardProps) {
  const alignment = align === "right" ? "items-end text-right" : "items-start text-left";

  if (!post) {
    return (
      <div
        className={`panel panel-static flex min-h-[6.5rem] flex-col justify-center gap-2 p-5 opacity-40 ${alignment}`}
        aria-hidden="true"
      >
        <span className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-ink-faint">
          {label}
        </span>
        <span className="text-sm text-ink-faint">沒有更多文章</span>
      </div>
    );
  }

  const gradient =
    align === "right"
      ? "bg-gradient-to-l from-[rgba(17,26,46,0.55)] via-[rgba(17,26,46,0.88)] to-[rgba(17,26,46,0.96)]"
      : "bg-gradient-to-r from-[rgba(17,26,46,0.55)] via-[rgba(17,26,46,0.88)] to-[rgba(17,26,46,0.96)]";

  return (
    <Link
      href={post.url}
      className={`panel group relative flex min-h-[6.5rem] flex-col justify-center gap-2 overflow-hidden p-5 ${alignment}`}
    >
      {/* cover thumb background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase(encodePath(post.cover))}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-30 transition-all duration-500 group-hover:scale-105 group-hover:opacity-45"
        aria-hidden="true"
      />
      <span className={`absolute inset-0 ${gradient}`} aria-hidden="true" />

      <span className="relative z-10 font-display text-xs font-semibold uppercase tracking-[0.3em] text-ink-faint transition-colors group-hover:text-cyan">
        {label}
      </span>
      <span className="relative z-10 line-clamp-2 font-bold leading-snug text-ink transition-colors group-hover:text-cyan">
        {post.title}
      </span>
    </Link>
  );
}

/** Previous / next article navigation, mirroring Hugo's 前一篇 / 後一篇. */
export default function PostNav({ prev, next }: PostNavProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="文章導覽"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <NavCard post={prev} label="前一篇 PREV" align="left" />
      <NavCard post={next} label="後一篇 NEXT" align="right" />
    </nav>
  );
}
