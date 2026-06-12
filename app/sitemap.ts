import type { MetadataRoute } from "next";
import { getCategories, getPostsByDate, getTags, type PostMeta } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { encodePath } from "@/lib/urlize";

export const dynamic = "force-static";

/**
 * Newest lastmod among a set of posts — keeps the sitemap deterministic
 * (derived from content, never from build time).
 */
function newestLastmod(posts: PostMeta[]): Date | undefined {
  let bestMs = Number.NEGATIVE_INFINITY;
  let best = "";
  for (const p of posts) {
    const iso = p.lastmod || p.date;
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best ? new Date(best) : undefined;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPostsByDate();
  const siteLastmod = newestLastmod(posts);

  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      ...(siteLastmod ? { lastModified: siteLastmod } : {}),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/archives/"),
      ...(siteLastmod ? { lastModified: siteLastmod } : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/categories/"),
      ...(siteLastmod ? { lastModified: siteLastmod } : {}),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/tags/"),
      ...(siteLastmod ? { lastModified: siteLastmod } : {}),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/about/"),
      ...(siteLastmod ? { lastModified: siteLastmod } : {}),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  for (const p of posts) {
    entries.push({
      url: absoluteUrl(encodePath(p.url)),
      ...(p.lastmod ? { lastModified: new Date(p.lastmod) } : {}),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const term of getCategories()) {
    const lastModified = newestLastmod(term.posts);
    entries.push({
      url: absoluteUrl(encodePath(`/categories/${term.slug}/`)),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  for (const term of getTags()) {
    const lastModified = newestLastmod(term.posts);
    entries.push({
      url: absoluteUrl(encodePath(`/tags/${term.slug}/`)),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly",
      priority: 0.3,
    });
  }

  return entries;
}
