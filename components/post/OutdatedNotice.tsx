"use client";

import { useEffect, useState } from "react";
import { OUTDATE_DAYS } from "@/lib/site";
import { formatDate } from "@/lib/format";

const MS_PER_DAY = 86_400_000;

/**
 * Shows a warning callout when the post's last modification is older than
 * OUTDATE_DAYS. The age is computed against the visitor's clock, so it only
 * renders after mount (client effect) to avoid a hydration mismatch.
 */
export default function OutdatedNotice({ lastmod }: { lastmod: string }) {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!lastmod) return;
    const modified = Date.parse(lastmod);
    if (Number.isNaN(modified)) return;
    const days = (Date.now() - modified) / MS_PER_DAY;
    setOutdated(days > OUTDATE_DAYS);
  }, [lastmod]);

  if (!outdated) return null;

  return (
    <div className="callout callout--warning" role="note">
      <div className="callout-title">
        <span className="callout-icon" aria-hidden="true" />
        內容可能過時
      </div>
      <div className="callout-body">
        <p>
          本文最後更新於 {formatDate(lastmod)}
          ，請注意文中內容可能已不適用。
        </p>
      </div>
    </div>
  );
}
