import type { Metadata } from "next";
import {
  SITE_TITLE,
  SITE_SUBTITLE,
  SITE_DESCRIPTION,
  SITE_AUTHOR,
  SITE_ORIGIN,
  BASE_PATH,
} from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_ORIGIN}${BASE_PATH}/`),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  description: `${SITE_SUBTITLE} — ${SITE_DESCRIPTION}`,
  authors: [{ name: SITE_AUTHOR }],
  icons: {
    icon: "/avatar/icon.webp",
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/index.xml", title: SITE_TITLE }],
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: `${SITE_SUBTITLE} — ${SITE_DESCRIPTION}`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen flex flex-col antialiased">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Rajdhani:wght@500;600;700&display=swap"
        />
        <SiteHeader />
        <main className="flex-1 w-full">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
