import { getPostsByDate } from "@/lib/content";
import {
  SITE_TITLE,
  SITE_SUBTITLE,
  SITE_DESCRIPTION,
  SITE_AUTHOR,
  SITE_EMAIL,
  absoluteUrl,
} from "@/lib/site";
import { encodePath } from "@/lib/urlize";

export const dynamic = "force-static";

/** Escape the five XML special characters for use in element content. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** /index.xml — RSS 2.0 feed of the 10 newest posts (Hugo-compatible URL). */
export async function GET(): Promise<Response> {
  const posts = getPostsByDate().slice(0, 10);

  // Keep builds deterministic: derive lastBuildDate from content, not Date.now.
  const newest = posts.length > 0 ? posts[0] : undefined;
  const lastBuildDate =
    newest && newest.date ? new Date(newest.date).toUTCString() : "";

  const author = xmlEscape(`${SITE_EMAIL} (${SITE_AUTHOR})`);

  const items = posts
    .map((p) => {
      const link = xmlEscape(absoluteUrl(encodePath(p.url)));
      const lines = [
        "    <item>",
        `      <title>${xmlEscape(p.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid>${link}</guid>`,
      ];
      if (p.date) {
        lines.push(`      <pubDate>${new Date(p.date).toUTCString()}</pubDate>`);
      }
      lines.push(`      <author>${author}</author>`);
      const description = p.summary || p.description;
      if (description) {
        lines.push(`      <description>${xmlEscape(description)}</description>`);
      }
      for (const category of p.categories) {
        lines.push(`      <category>${xmlEscape(category)}</category>`);
      }
      lines.push("    </item>");
      return lines.join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(SITE_TITLE)}</title>
    <link>${xmlEscape(absoluteUrl("/"))}</link>
    <description>${xmlEscape(`${SITE_SUBTITLE} — ${SITE_DESCRIPTION}`)}</description>
    <language>zh-TW</language>
    <managingEditor>${author}</managingEditor>
    <webMaster>${author}</webMaster>
${lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` : ""}    <atom:link href="${xmlEscape(absoluteUrl("/index.xml"))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
