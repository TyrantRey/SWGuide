import type { Metadata } from "next";
import Link from "next/link";
import { getPostsByDate, type PostMeta } from "@/lib/content";
import { formatDate, formatYear } from "@/lib/format";

export const metadata: Metadata = {
  title: "彙整",
};

/** Group posts (already newest-first) by year, preserving descending order. */
function groupByYear(posts: PostMeta[]): [string, PostMeta[]][] {
  const groups = new Map<string, PostMeta[]>();
  for (const post of posts) {
    const year = formatYear(post.date) || "未知";
    const list = groups.get(year);
    if (list) {
      list.push(post);
    } else {
      groups.set(year, [post]);
    }
  }
  return [...groups.entries()];
}

export default function ArchivesPage() {
  const posts = getPostsByDate();
  const years = groupByYear(posts);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header>
        <div className="hud-chip">ARCHIVES</div>
        <h1 className="section-title mt-2">彙整</h1>
        <p className="mt-3 text-sm text-ink-dim">
          共{" "}
          <span className="font-display text-base font-semibold text-cyan">
            {posts.length}
          </span>{" "}
          篇文章
        </p>
      </header>

      {years.map(([year, yearPosts]) => (
        <section key={year} className="mt-12">
          <h2 className="flex items-baseline gap-4">
            <span className="neon-text font-display text-4xl font-bold tracking-[0.1em] tabular-nums">
              {year}
            </span>
            <span className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-ink-faint">
              {yearPosts.length} POSTS
            </span>
          </h2>

          <ul className="mt-6 border-l border-line pl-6">
            {yearPosts.map((post) => (
              <li key={post.slug} className="group relative">
                <span
                  className="absolute top-1/2 -left-[29px] h-2 w-2 -translate-y-1/2 rotate-45 border border-line-bright bg-panel transition-colors duration-200 group-hover:border-cyan group-hover:bg-cyan/40"
                  aria-hidden="true"
                />
                <Link
                  href={post.url}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 py-3"
                >
                  <time
                    dateTime={formatDate(post.date)}
                    className="font-display text-sm font-semibold tracking-[0.18em] text-ink-faint tabular-nums"
                  >
                    {formatDate(post.date)}
                  </time>
                  <span className="min-w-0 font-medium text-ink transition-colors duration-200 group-hover:text-cyan">
                    {post.title}
                  </span>
                  {post.categories.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {post.categories.map((c) => (
                        <span key={c} className="capsule text-[0.7rem]">
                          {c}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
