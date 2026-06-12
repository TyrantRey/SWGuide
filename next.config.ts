import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// On GitHub Pages this is set by CI from actions/configure-pages (e.g. "/SWGuide").
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * `output: "export"` is applied ONLY during `next build` (the production build
 * phase). Enabling it for `next dev` makes the dev server validate every
 * requested path against generateStaticParams, which mis-handles this site's
 * percent-encoded CJK catch-all URLs and throws
 *   Page "/post/[...slug]/page" is missing param "/post/[...slug]" …
 * (see vercel/next.js#56477). Dev mode renders the same routes on demand.
 */
export default function config(phase: string): NextConfig {
  const isBuild = phase === PHASE_PRODUCTION_BUILD;
  return {
    ...(isBuild ? { output: "export" as const } : {}),
    trailingSlash: true,
    ...(basePath ? { basePath } : {}),
    env: {
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
    images: {
      unoptimized: true,
    },
  };
}
