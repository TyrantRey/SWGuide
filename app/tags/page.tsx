import type { Metadata } from "next";
import Link from "next/link";
import { getTags } from "@/lib/content";

export const metadata: Metadata = {
  title: "標籤",
};

/** Scale tag size by post count: bigger buckets read louder in the cloud. */
function tagSizeClass(count: number): string {
  if (count >= 10) return "text-lg";
  if (count >= 5) return "text-base";
  return "text-sm";
}

export default function TagsPage() {
  const tags = getTags();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header>
        <div className="hud-chip">TAGS</div>
        <h1 className="section-title mt-2">標籤</h1>
        <p className="mt-3 text-sm text-ink-dim">
          共{" "}
          <span className="font-display text-base font-semibold text-cyan">
            {tags.length}
          </span>{" "}
          個標籤
        </p>
      </header>

      {tags.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">目前尚無標籤。</p>
      ) : (
        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-3.5">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}/`}
              className={`capsule capsule--accent ${tagSizeClass(tag.posts.length)}`}
            >
              <span>{tag.name}</span>
              <span className="font-display text-[0.72em] font-semibold tracking-[0.1em] text-ink-faint tabular-nums">
                {tag.posts.length}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
