/**
 * Replicates Hugo's `urlize` so every URL of the old Hugo site keeps working.
 *
 * Verified against the Hugo build output (`_migration-baseline-urls.txt`):
 *   "AR卡篇"  -> "ar卡篇"   (ASCII lowercased, CJK kept)
 *   "SD 勳章" -> "sd-勳章"  (whitespace -> hyphen)
 *   "琪-阿露爾" -> "琪-阿露爾"
 */
export function urlize(segment: string): string {
  return segment
    .trim()
    .replace(/['"<>?#%{}|\\^`\[\]]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/** Urlize each segment of a slash-separated path ("系統/AR卡篇" -> "系統/ar卡篇"). */
export function urlizePath(p: string): string {
  return p
    .split("/")
    .filter(Boolean)
    .map(urlize)
    .join("/");
}

/** Percent-encode a URL path for safe use in an HTML attribute (keeps "/"). */
export function encodePath(p: string): string {
  return p
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}
