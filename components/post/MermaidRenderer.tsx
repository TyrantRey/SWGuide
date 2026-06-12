"use client";

import { useEffect } from "react";

interface MermaidApi {
  initialize(config: { startOnLoad: boolean; theme: string }): void;
  run(options: { querySelector: string }): Promise<void>;
}

/**
 * Lazily loads Mermaid from the CDN (only on pages that contain a diagram)
 * and renders every `<pre class="mermaid">` block produced by lib/markdown.
 * Renders nothing itself.
 */
export default function MermaidRenderer({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      try {
        const mod = (await import(
          /* webpackIgnore: true */
          // @ts-expect-error -- remote ESM module, resolved by the browser at runtime
          "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
        )) as { default: MermaidApi };
        if (cancelled) return;

        const mermaid = mod.default;
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        await mermaid.run({ querySelector: "pre.mermaid" });
      } catch (err) {
        console.warn("[mermaid] failed to load or render diagrams:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}
