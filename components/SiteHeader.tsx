"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_SUBTITLE, AVATAR_IMAGE, withBase } from "@/lib/site";

const NAV = [
  { label: "首頁", en: "HOME", href: "/" },
  { label: "傷害計算", en: "DAMAGE", href: "/damage/" },
  { label: "彙整", en: "ARCHIVES", href: "/archives/" },
  { label: "分類", en: "CATEGORIES", href: "/categories/" },
  { label: "標籤", en: "TAGS", href: "/tags/" },
  { label: "關於", en: "ABOUT", href: "/about/" },
];

export default function SiteHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[rgba(7,10,18,0.82)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(AVATAR_IMAGE)}
            alt=""
            width={34}
            height={34}
            className="h-8.5 w-8.5 shrink-0 rounded border border-line-bright"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-bold tracking-wide text-ink">
              靈魂行者<span className="text-cyan">退坑</span>指南
            </span>
            <span className="hidden text-[0.68rem] tracking-[0.3em] text-ink-faint sm:block">
              {SITE_SUBTITLE}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex shrink-0 flex-col items-center px-3 py-1 transition-colors ${active ? "text-cyan" : "text-ink-dim hover:text-ink"
                  }`}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span
                  className="font-display text-[0.58rem] font-semibold tracking-[0.25em] opacity-60"
                  aria-hidden="true"
                >
                  {item.en}
                </span>
                <span
                  className={`absolute inset-x-2 -bottom-2.75 h-0.5 transition-all ${active
                      ? "bg-cyan shadow-[0_0_10px_rgba(61,232,255,0.8)]"
                      : "bg-transparent group-hover:bg-line-bright"
                    }`}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
