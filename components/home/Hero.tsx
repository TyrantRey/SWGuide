import Link from "next/link";
import {
  BANNER_IMAGE,
  SITE_DESCRIPTION,
  SITE_SUBTITLE,
  SINCE_YEAR,
  withBase,
} from "@/lib/site";
import { encodePath } from "@/lib/urlize";

export interface HeroStat {
  /** English HUD label, rendered uppercase. */
  label: string;
  value: number;
}

/** Angular clip applied to the CTA buttons (cut top-left / bottom-right corners). */
const CTA_CLIP =
  "[clip-path:polygon(16px_0,100%_0,100%_calc(100%-16px),calc(100%-16px)_100%,0_100%,0_16px)]";

/**
 * Full-width hero: SoulWorker key art under layered dark gradients,
 * scanline + HUD-grid flavour, giant gradient title and two angular
 * neon CTA buttons, finished with a stats strip.
 */
export default function Hero({ stats }: { stats: HeroStat[] }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* key art */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase(encodePath(BANNER_IMAGE))}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
      />
      {/* dark gradient overlays so text pops */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-bg via-bg/80 to-bg/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-bg via-transparent to-bg/70"
      />
      {/* scanlines */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.4)_0_1px,transparent_1px_4px)]"
      />
      {/* faint HUD grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(61,232,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(61,232,255,0.04)_1px,transparent_1px)] [bg-size:48px_48px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-24 md:pb-16 md:pt-32">
        <div className="hud-chip">Soulworker Survival Guide</div>

        <h1 className="text-gradient mt-5 max-w-3xl text-[clamp(2.5rem,7vw,4.6rem)] font-black leading-[1.12] tracking-wide">
          靈魂行者退坑指南
        </h1>

        <p className="mt-4 flex items-center gap-3 text-xl font-bold text-ink md:text-2xl">
          <span aria-hidden="true" className="font-display font-bold text-magenta">
            //
          </span>
          {SITE_SUBTITLE}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/post/前言/"
            className="group transition-[filter] duration-300 hover:drop-shadow-[0_0_18px_rgba(61,232,255,0.6)]"
          >
            <span
              className={`inline-flex items-center gap-3 bg-cyan px-8 py-3.5 font-display text-sm font-bold uppercase tracking-[0.22em] text-bg transition-colors duration-300 group-hover:bg-[#8ef2ff] ${CTA_CLIP}`}
            >
              開始閱讀 / Start
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                ▸
              </span>
            </span>
          </Link>

          <Link
            href="/post/入坑前/"
            className="group transition-[filter] duration-300 hover:drop-shadow-[0_0_18px_rgba(255,61,138,0.5)]"
          >
            <span
              className={`inline-flex items-center gap-3 border border-magenta/60 bg-bg/40 px-8 py-3.5 font-display text-sm font-bold uppercase tracking-[0.22em] text-magenta backdrop-blur-sm transition-colors duration-300 group-hover:border-magenta group-hover:bg-magenta/10 group-hover:text-[#ff7ab1] ${CTA_CLIP}`}
            >
              入坑須知 / Before You Dive
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                ▸
              </span>
            </span>
          </Link>
        </div>

        {/* HUD stats strip */}
        <div className="mt-12 flex flex-wrap gap-x-12 gap-y-5 border-t border-line-bright/40 pt-6">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="neon-text font-display text-3xl font-bold leading-none">
                {s.value}
              </div>
              <div className="mt-1.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
                {s.label}
              </div>
            </div>
          ))}
          <div>
            <div className="font-display text-3xl font-bold leading-none text-ink-dim">
              {SINCE_YEAR}
            </div>
            <div className="mt-1.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
              Since
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
