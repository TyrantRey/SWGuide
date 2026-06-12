import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import { getTags, type TaxonomyTerm } from "@/lib/content";
import { urlize } from "@/lib/urlize";

interface PageProps {
  params: Promise<{ term: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { term: string }[] {
  return getTags().map((t) => ({ term: t.slug }));
}

/** Route params arrive percent-encoded — decode and re-urlize before matching. */
function findTag(term: string): TaxonomyTerm | undefined {
  return getTags().find((t) => t.slug === urlize(decodeURIComponent(term)));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { term } = await params;
  const tag = findTag(term);
  return {
    title: tag ? `標籤：${tag.name}` : "標籤",
  };
}

export default async function TagTermPage({ params }: PageProps) {
  const { term } = await params;
  const tag = findTag(term);
  if (!tag) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header>
        <div className="hud-chip">TAG</div>
        <h1 className="section-title mt-2">
          標籤：<span className="text-magenta">{tag.name}</span>
        </h1>
        <p className="mt-3 text-sm text-ink-dim">
          共{" "}
          <span className="font-display text-base font-semibold text-magenta">
            {tag.posts.length}
          </span>{" "}
          篇文章
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-4">
        {tag.posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
