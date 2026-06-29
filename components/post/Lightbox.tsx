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
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-[4vmin] bg-[rgba(5,8,16,0.88)] backdrop-blur-xs cursor-zoom-out animate-lightbox-fade"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="max-w-[92vw] max-h-[92vh] w-auto h-auto rounded-md border border-line-bright shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
        src={view.src}
        alt={view.alt}
      />
      <button
        type="button"
        className="fixed top-[1.1rem] right-[1.3rem] flex items-center justify-center w-[2.4rem] h-[2.4rem] text-[1.7rem] leading-none rounded-sm text-ink bg-[rgba(13,19,34,0.85)] border border-line-bright cursor-pointer hover:text-cyan hover:border-cyan"
        aria-label="關閉"
        onClick={close}
      >
        ×
      </button>
    </div>
  );
}
