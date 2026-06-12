/** Site-wide constants (migrated from hugo.toml + config/_default/params.yml). */

export const SITE_TITLE = "Soulworker 靈魂行者退坑指南";
export const SITE_SUBTITLE = "從入門到放棄";
export const SITE_DESCRIPTION = "Work for desire. Work from desire.";
export const SITE_AUTHOR = "TyrantRey";
export const SITE_EMAIL = "work@kurumi-tokisaki.com";
export const SITE_LANG = "zh-TW";
export const SINCE_YEAR = 2025;

/** Origin the site is served from (no trailing slash, no base path). */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://tyrantrey.github.io";

/** Base path when hosted under a sub-path (GitHub project pages), e.g. "/SWGuide". */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Absolute canonical URL for a site-relative path ("/post/前言/"). */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${BASE_PATH}${path}`;
}

/**
 * Prefix a site-relative URL with the base path. Use for every URL that is
 * emitted as a raw HTML attribute (next/link handles this on its own).
 */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

export const SOCIAL_LINKS = [
  { name: "GitHub", url: "https://github.com/TyrantRey" },
  { name: "YouTube", url: "https://www.youtube.com/@tyrantrey" },
  { name: "Discord", url: "https://discordapp.com/users/496941805196017673" },
  { name: "Steam", url: "https://steamcommunity.com/id/TyrantRey" },
  { name: "Email", url: "mailto:work@kurumi-tokisaki.com" },
] as const;

/** Random-cover pool (migrated from data/covers.yml), served from public/covers. */
export const COVER_POOL = [
  "/covers/Loading_Squirrel_PC_A.png",
  "/covers/Loading_Squirrel_PC_B.png",
  "/covers/Loading_Squirrel_PC_C.png",
  "/covers/Loading_Squirrel_PC_D.png",
  "/covers/Loading_Squirrel_PC_E.png",
  "/covers/Loading_Squirrel_PC_F.png",
  "/covers/Loading_Squirrel_PC_G.png",
  "/covers/Loading_Squirrel_PC_H.png",
  "/covers/Loading_Squirrel_PC_I.png",
  "/covers/Loading_Squirrel_PC_J.png",
] as const;

export const BANNER_IMAGE = "/images/soulworker banner.png";
export const AVATAR_IMAGE = "/avatar/icon.webp";

/** A post whose lastmod is older than this many days shows an "outdated" notice. */
export const OUTDATE_DAYS = 180;
