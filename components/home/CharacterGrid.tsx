import Link from "next/link";
import type { PostMeta } from "@/lib/content";
import { withBase } from "@/lib/site";
import { encodePath } from "@/lib/urlize";

/**
 * 角色 — character roster grid (2 → 3 → 5 columns). Each card is a tall
 * cover with a bottom gradient, UNIT index tag and neon hover glow.
 */
export default function CharacterGrid({ posts }: { posts: PostMeta[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {posts.map((post, i) => (
        <Link
          key={post.slug}
          href={post.url}
          className="group relative block aspect-[3/4] overflow-hidden border border-line bg-panel transition-all duration-300 hover:-translate-y-1 hover:border-cyan/60 hover:shadow-[0_0_28px_rgba(61,232,255,0.22)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(encodePath(post.cover))}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* UNIT index tag */}
          <span className="absolute left-2 top-2 border border-cyan/30 bg-bg/60 px-1.5 py-0.5 font-display text-[0.65rem] font-semibold tracking-[0.25em] text-cyan/80 backdrop-blur-sm">
            Unit {String(i + 1).padStart(2, "0")}
          </span>

          {/* bottom gradient + name */}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(7,10,18,0.95)] via-[rgba(7,10,18,0.55)] to-transparent p-3 pt-10">
            <span className="block truncate text-sm font-bold text-ink transition-colors duration-300 group-hover:text-cyan md:text-base">
              {post.title}
            </span>
            <span
              aria-hidden="true"
              className="mt-1.5 block h-0.5 w-6 bg-magenta transition-all duration-300 group-hover:w-12 group-hover:bg-cyan"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}
