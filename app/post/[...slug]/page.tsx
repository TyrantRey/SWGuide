import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdjacentPosts, getAllPosts, getPost } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { withBase } from "@/lib/site";
import { encodePath, urlize } from "@/lib/urlize";
import Lightbox from "@/components/post/Lightbox";
import MermaidRenderer from "@/components/post/MermaidRenderer";
import OutdatedNotice from "@/components/post/OutdatedNotice";
import PostNav from "@/components/post/PostNav";
import TableOfContents from "@/components/post/TableOfContents";
import TableSearch from "@/components/post/TableSearch";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return getAllPosts().map((p) => ({ slug: p.segments }));
}

interface PostPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  const description = post.description || post.summary || undefined;
  return {
    title: post.title,
    description,
    keywords: post.keywords || undefined,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: post.url,
      images: [encodePath(post.cover)],
      publishedTime: post.date || undefined,
      modifiedTime: post.lastmod || undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { prev, next } = getAdjacentPosts(post.slug);
  const firstCategory = post.categories[0];
  const hasToc = post.toc.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex items-start gap-10">
        {/* ------------------------------------------------ article column */}
        <article className="mx-auto w-full min-w-0 max-w-4xl flex-1">
          {/* breadcrumb */}
          <nav
            aria-label="麵包屑"
            className="flex flex-wrap items-center gap-2 text-sm text-ink-faint"
          >
            <Link href="/" className="transition-colors hover:text-cyan">
              首頁
            </Link>
            {firstCategory ? (
              <>
                <span aria-hidden="true" className="text-ink-faint">
                  ›
                </span>
                <Link
                  href={`/categories/${urlize(firstCategory)}/`}
                  className="transition-colors hover:text-cyan"
                >
                  {firstCategory}
                </Link>
              </>
            ) : null}
            <span aria-hidden="true" className="text-ink-faint">
              ›
            </span>
            <span className="min-w-0 truncate text-ink-dim">{post.title}</span>
          </nav>

          {/* header */}
          <header className="mt-5 space-y-4">
            <h1 className="text-3xl font-black leading-tight tracking-wide text-ink sm:text-4xl">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {post.categories.map((c) => (
                <Link
                  key={c}
                  href={`/categories/${urlize(c)}/`}
                  className="capsule text-[0.78rem]"
                >
                  {c}
                </Link>
              ))}
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">
                發布 {formatDate(post.date)} · 更新 {formatDate(post.lastmod)} ·{" "}
                {post.wordCount} 字 · 約 {post.readingMinutes} 分鐘
              </p>
            </div>
          </header>

          {/* collapsible TOC for < xl screens */}
          {hasToc ? (
            <details className="panel panel-static mt-8 px-5 py-4 xl:hidden">
              <summary className="hud-chip cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                目錄 INDEX
              </summary>
              <div className="mt-4">
                <TableOfContents toc={post.toc} hideHeader />
              </div>
            </details>
          ) : null}

          {/* cover hero (only when the post declares its own cover) */}
          {post.hasExplicitCover ? (
            <div className="panel panel-static mt-8 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase(encodePath(post.cover))}
                alt={post.title}
                className="aspect-[21/9] w-full object-cover"
              />
            </div>
          ) : null}

          <div className="mt-8">
            <OutdatedNotice lastmod={post.lastmod} />

            {/* article body */}
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </div>

          {/* tag row */}
          {post.tags.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-ink-faint">
                Tags
              </span>
              {post.tags.map((t) => (
                <Link
                  key={t}
                  href={`/tags/${urlize(t)}/`}
                  className="capsule capsule--accent text-[0.8rem]"
                >
                  # {t}
                </Link>
              ))}
            </div>
          ) : null}

          {/* prev / next navigation */}
          <div className="mt-10">
            <PostNav prev={prev} next={next} />
          </div>
        </article>

        {/* ------------------------------------------------ TOC rail (xl+) */}
        {hasToc ? (
          <aside className="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-64 shrink-0 overflow-y-auto pr-1 xl:block">
            <TableOfContents toc={post.toc} />
          </aside>
        ) : null}
      </div>

      <MermaidRenderer enabled={post.hasMermaid} />
      <TableSearch key={post.url} />
      <Lightbox />
    </div>
  );
}
