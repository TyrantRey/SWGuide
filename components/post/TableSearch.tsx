"use client";

import { useEffect } from "react";

/** Only tables with at least this many body rows get a filter box. */
const MIN_ROWS = 12;

/**
 * Adds a live filter box above every large data table (e.g. the AR-card
 * lists). Typing hides the `<tbody>` rows whose text doesn't contain the
 * query (matches 卡名 / 能力 / 效果 — anything rendered as text). Enhances the
 * HTML injected by lib/markdown into `.prose`; renders nothing itself. Mounted
 * with a `key` per post so it re-initialises on client-side navigation.
 */
export default function TableSearch() {
  useEffect(() => {
    const prose = document.querySelector(".prose");
    if (!prose) return;

    const cleanups: Array<() => void> = [];

    prose.querySelectorAll<HTMLDivElement>(".table-wrap").forEach((wrap) => {
      const body = wrap.querySelector("table")?.tBodies[0];
      if (!body || body.rows.length < MIN_ROWS) return;
      if (wrap.previousElementSibling?.classList.contains("table-search")) return;

      const rows = Array.from(body.rows);
      const texts = rows.map((r) => (r.textContent ?? "").toLowerCase());
      const total = rows.length;

      const box = document.createElement("div");
      box.className = "table-search";

      const input = document.createElement("input");
      input.type = "search";
      input.autocomplete = "off";
      input.placeholder = "搜尋…";
      input.setAttribute("aria-label", "搜尋表格");

      const count = document.createElement("span");
      count.className = "table-search-count";
      count.textContent = `${total} 條項目`;

      box.append(input, count);
      wrap.parentNode?.insertBefore(box, wrap);

      const onInput = () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        for (let i = 0; i < rows.length; i += 1) {
          const hit = q === "" || texts[i].includes(q);
          rows[i].hidden = !hit;
          if (hit) shown += 1;
        }
        count.textContent = q ? `${shown} / ${total}` : `${total} 條項目`;
        box.classList.toggle("is-empty", q !== "" && shown === 0);
      };

      input.addEventListener("input", onInput);
      cleanups.push(() => {
        input.removeEventListener("input", onInput);
        for (const r of rows) r.hidden = false;
        box.remove();
      });
    });

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
