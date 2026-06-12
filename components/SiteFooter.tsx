import { SITE_TITLE, SITE_AUTHOR, SINCE_YEAR, SOCIAL_LINKS } from "@/lib/site";

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();
  const yearRange =
    currentYear > SINCE_YEAR ? `${SINCE_YEAR}–${currentYear}` : `${SINCE_YEAR}`;
  return (
    <footer className="mt-20 border-t border-line bg-[rgba(12,17,32,0.6)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
        <div className="hud-chip">SOULWORKER GUIDE</div>
        <p className="text-sm text-ink-dim">
          © {yearRange} {SITE_AUTHOR} · {SITE_TITLE}
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display font-semibold tracking-[0.18em] text-ink-faint transition-colors hover:text-cyan"
            >
              {s.name.toUpperCase()}
            </a>
          ))}
        </nav>
        <p className="text-xs text-ink-faint">
          內容整理自網路資源，僅供學習交流；圖像版權歸 SoulWorker 及原作者所有。
        </p>
      </div>
    </footer>
  );
}
