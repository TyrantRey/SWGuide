import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import { getCategories, type TaxonomyTerm } from "@/lib/content";
import { urlize } from "@/lib/urlize";

interface PageProps {
  params: Promise<{ term: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { term: string }[] {
  return getCategories().map((c) => ({ term: c.slug }));
}

/** Route params arrive percent-encoded — decode and re-urlize before matching. */
function findCategory(term: string): TaxonomyTerm | undefined {
  return getCategories().find((c) => c.slug === urlize(decodeURIComponent(term)));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { term } = await params;
  const category = findCategory(term);
  return {
    title: category ? `分類：${category.name}` : "分類",
  };
}

export default async function CategoryTermPage({ params }: PageProps) {
  const { term } = await params;
  const category = findCategory(term);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header>
        <div className="hud-chip">CATEGORY</div>
        <h1 className="section-title mt-2">分類：{category.name}</h1>
        <p className="mt-3 text-sm text-ink-dim">
          共{" "}
          <span className="font-display text-base font-semibold text-cyan">
            {category.posts.length}
          </span>{" "}
          篇文章
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-4">
        {category.posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
