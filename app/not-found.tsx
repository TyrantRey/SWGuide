import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — 找不到頁面",
};

/**
 * Global 404. Statically exported as 404.html and served from any path on
 * GitHub Pages — only <Link> navigation (basePath-aware) is used here.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="hud-chip">Connection Lost</div>

      <div
        className="text-gradient mt-4 font-display text-[clamp(5.5rem,18vw,10rem)] font-bold leading-none tracking-[0.08em] drop-shadow-[0_0_28px_rgba(61,232,255,0.35)]"
        aria-hidden="true"
      >
        404
      </div>

      <p className="mt-6 text-xl font-bold text-ink">
        満身創痍 (ﾟ⊿ﾟ)ﾂ — 這個頁面已經退坑了
      </p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
        訊號中斷：你要找的攻略可能已改名、搬家，或從未存在。
        到彙整頁看看吧，所有文章都在那裡待命。
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-baseline gap-2 border border-cyan/60 bg-cyan/10 px-7 py-3 font-bold text-cyan transition-all duration-200 [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)] hover:bg-cyan/20 hover:shadow-[0_0_28px_rgba(61,232,255,0.3)]"
        >
          返回首頁
          <span className="font-display text-xs font-semibold tracking-[0.3em]">
            / HOME
          </span>
        </Link>
        <Link
          href="/archives/"
          className="inline-flex items-baseline gap-2 border border-magenta/50 bg-magenta/10 px-7 py-3 font-bold text-magenta transition-all duration-200 [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)] hover:bg-magenta/20 hover:shadow-[0_0_28px_rgba(255,61,138,0.3)]"
        >
          瀏覽彙整
          <span className="font-display text-xs font-semibold tracking-[0.3em]">
            / ARCHIVES
          </span>
        </Link>
      </div>
    </div>
  );
}
