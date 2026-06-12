import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAboutPage } from "@/lib/content";
import {
  AVATAR_IMAGE,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SOCIAL_LINKS,
  withBase,
} from "@/lib/site";
import { encodePath } from "@/lib/urlize";

export const metadata: Metadata = {
  title: "關於",
  description: `關於 ${SITE_AUTHOR} — ${SITE_DESCRIPTION}`,
};

/** /about/ — the standalone about page rendered from content/about.md. */
export default async function AboutPage() {
  const about = await getAboutPage();
  if (!about) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <header className="mb-10">
        <div className="hud-chip">ABOUT</div>
        <h1 className="section-title mt-2">{about.title}</h1>
      </header>

      {/* Player profile intro card */}
      <section className="panel panel-static mb-10 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(encodePath(AVATAR_IMAGE))}
            alt={SITE_AUTHOR}
            width={112}
            height={112}
            loading="lazy"
            className="h-28 w-28 shrink-0 rounded-full border border-line-bright object-cover shadow-[0_0_24px_rgba(61,232,255,0.18)]"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="font-display text-xs font-semibold uppercase tracking-[0.32em] text-ink-faint">
              Player Profile
            </div>
            <div className="mt-1 text-2xl font-bold text-ink">{SITE_AUTHOR}</div>
            <p className="mt-1 text-sm leading-relaxed text-ink-dim">{SITE_DESCRIPTION}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target={link.url.startsWith("http") ? "_blank" : undefined}
                  rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-cyan"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rendered markdown body */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: about.html }} />
    </div>
  );
}
