"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Click-to-zoom for article images. Listens for clicks on any `<img>` inside
 * `.prose` (e.g. the AR-card table thumbnails) and shows it full-size in an
 * overlay. Linked images and post-link-card covers are left alone. Closes on
 * backdrop/✕ click or Escape. Renders nothing until an image is opened.
 */
export default function Lightbox() {
  const [view, setView] = useState<{ src: string; alt: string } | null>(null);
  const close = useCallback(() => setView(null), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const img = (e.target as HTMLElement | null)?.closest?.("img") as HTMLImageElement | null;
      if (!img || !img.closest(".prose")) return;
      if (img.closest("a") || img.closest(".post-link-card")) return; // already interactive
      e.preventDefault();
      setView({ src: img.currentSrc || img.src, alt: img.alt || "" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!view) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // freeze background scroll
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [view, close]);

  if (!view) return null;

  return (
    <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={close}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lightbox-img" src={view.src} alt={view.alt} />
      <button type="button" className="lightbox-close" aria-label="關閉" onClick={close}>
        ×
      </button>
    </div>
  );
}
