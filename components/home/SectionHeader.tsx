import Link from "next/link";

/**
 * Standard home-page section header: HUD chip + big display title on the
 * left, optional "view all"-style action link on the right.
 */
export default function SectionHeader({
  chip,
  title,
  action,
}: {
  /** English HUD label (rendered uppercase / letter-spaced). */
  chip: string;
  /** zh-TW section title. */
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <div className="hud-chip">{chip}</div>
        <h2 className="section-title mt-2">{title}</h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-2 pb-1 font-display text-sm font-semibold uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-cyan"
        >
          {action.label}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            ▸
          </span>
        </Link>
      ) : null}
    </div>
  );
}
