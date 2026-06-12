"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** Indent steps for heading depths 2 / 3 / 4 (border rail sits at the left). */
const DEPTH_PADDING: Record<number, string> = {
  2: "pl-3",
  3: "pl-7",
  4: "pl-11",
};

interface TableOfContentsProps {
  toc: TocItem[];
  /** Hide the built-in「目錄 INDEX」chip (the mobile <details> supplies its own). */
  hideHeader?: boolean;
}

/**
 * Article table of contents with IntersectionObserver scroll-spy:
 * the heading currently in view gets a neon-cyan left bar.
 */
export default function TableOfContents({
  toc,
  hideHeader = false,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (toc.length === 0) return;

    const headings = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();

    const pickActive = () => {
      // Prefer the first TOC entry whose heading intersects the spy band.
      const intersecting = toc.find((item) => visible.has(item.id));
      if (intersecting) {
        setActiveId(intersecting.id);
        return;
      }
      // Otherwise fall back to the last heading scrolled above the band.
      let current = "";
      for (const el of headings) {
        if (el.getBoundingClientRect().top < 120) current = el.id;
      }
      if (current) setActiveId(current);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        pickActive();
      },
      // Band just below the sticky header, ignoring the lower 60% of the viewport.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    for (const el of headings) observer.observe(el);
    pickActive();

    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <nav aria-label="目錄">
      {hideHeader ? null : <div className="hud-chip mb-3">目錄 INDEX</div>}
      <ul className="space-y-0.5">
        {toc.map((item) => {
          const isActive = item.id === activeId;
          const padding = DEPTH_PADDING[item.depth] ?? "pl-3";
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={`block border-l-2 py-1 pr-2 text-sm leading-relaxed transition-all duration-200 ${padding} ${
                  isActive
                    ? "border-cyan bg-cyan/5 text-cyan shadow-[inset_4px_0_14px_-6px_rgba(61,232,255,0.65)]"
                    : "border-line text-ink-faint hover:border-line-bright hover:text-ink-dim"
                }`}
                aria-current={isActive ? "true" : undefined}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
