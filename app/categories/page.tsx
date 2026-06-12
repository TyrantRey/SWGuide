import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/content";

export const metadata: Metadata = {
  title: "分類",
};

export default function CategoriesPage() {
  const categories = getCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header>
        <div className="hud-chip">CATEGORIES</div>
        <h1 className="section-title mt-2">分類</h1>
        <p className="mt-3 text-sm text-ink-dim">
          共{" "}
          <span className="font-display text-base font-semibold text-cyan">
            {categories.length}
          </span>{" "}
          個分類
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">目前尚無分類。</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}/`}
              className="panel group flex items-center justify-between gap-4 px-6 py-5 transition-shadow duration-300 hover:shadow-[0_0_24px_rgba(61,232,255,0.18)]"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-lg font-bold text-ink transition-colors duration-200 group-hover:text-cyan">
                  {category.name}
                </span>
                <span className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
                  POSTS
                </span>
              </span>
              <span className="font-display text-4xl font-bold text-cyan/75 transition-colors duration-200 tabular-nums group-hover:text-cyan">
                {category.posts.length}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
