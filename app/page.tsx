import { getAllPosts, getPostBySegments, type PostMeta } from "@/lib/content";
import PostCard from "@/components/PostCard";
import Hero, { type HeroStat } from "@/components/home/Hero";
import SectionHeader from "@/components/home/SectionHeader";
import QuickStart, { type QuickStartItem } from "@/components/home/QuickStart";
import CharacterGrid from "@/components/home/CharacterGrid";
import SystemCards, { type SystemCardItem } from "@/components/home/SystemCards";
import DungeonSection from "@/components/home/DungeonSection";

/** 快速開始 entry points, in reading order. */
const QUICK_START_DEFS: { segments: string[]; en: string }[] = [
  { segments: ["前言"], en: "Prologue" },
  { segments: ["入坑前"], en: "Before You Dive" },
  { segments: ["回鍋入坑", "新手入坑"], en: "Fresh Start" },
];

interface SystemDef {
  /** Route segments of the directory post (slugs are urlized lowercase). */
  segments: string[];
  zh: string;
  en: string;
  /** Slug prefix used to count the guides living under this sub-folder. */
  prefix: string;
}

/** 系統 directory cards — first entry is the featured overview. */
const SYSTEM_DEFS: SystemDef[] = [
  { segments: ["系統", "系統目錄"], zh: "系統總覽", en: "Overview", prefix: "系統/" },
  {
    segments: ["系統", "防具裝備篇", "防具裝備目錄"],
    zh: "防具裝備",
    en: "Equipment",
    prefix: "系統/防具裝備篇/",
  },
  {
    segments: ["系統", "勳章篇", "勳章目錄"],
    zh: "勳章",
    en: "Medals",
    prefix: "系統/勳章篇/",
  },
  {
    segments: ["系統", "ar卡篇", "ar卡目錄"],
    zh: "AR卡",
    en: "AR Cards",
    prefix: "系統/ar卡篇/",
  },
  {
    segments: ["系統", "靈魂小夥伴篇", "靈魂小夥伴目錄"],
    zh: "靈魂小夥伴",
    en: "Soul Pets",
    prefix: "系統/靈魂小夥伴篇/",
  },
];

/** NaN-safe timestamp for sorting by lastmod. */
function ts(iso: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export default function HomePage() {
  const posts = getAllPosts();

  // 1. quick start
  const quickStart: QuickStartItem[] = QUICK_START_DEFS.flatMap((def) => {
    const post = getPostBySegments(def.segments);
    return post ? [{ post, en: def.en }] : [];
  });

  // 2. characters (角色篇/*, minus the directory post)
  const characters = posts.filter(
    (p) => p.slug.startsWith("角色篇/") && !p.slug.endsWith("角色目錄"),
  );

  // 3. systems
  const buildSystem = (def: SystemDef): SystemCardItem | undefined => {
    const post = getPostBySegments(def.segments);
    if (!post) return undefined;
    const count = posts.filter(
      (p) => p.slug.startsWith(def.prefix) && p.slug !== post.slug,
    ).length;
    return { post, zh: def.zh, en: def.en, count };
  };
  const systemOverview = buildSystem(SYSTEM_DEFS[0]);
  const systemItems = SYSTEM_DEFS.slice(1)
    .map((def) => buildSystem(def))
    .filter((item): item is SystemCardItem => item !== undefined);

  // 4. dungeons
  const dungeonLead = getPostBySegments(["副本", "副本篇"]);
  const dungeons = posts.filter((p) => p.slug.startsWith("副本/主要副本/"));

  // 5. recent updates (by lastmod, newest first)
  const recent = [...posts].sort((a, b) => ts(b.lastmod) - ts(a.lastmod)).slice(0, 6);

  const heroStats: HeroStat[] = [
    { label: "Guides", value: posts.length },
    { label: "Characters", value: characters.length },
    { label: "Raids", value: dungeons.length },
  ];

  return (
    <>
      <Hero stats={heroStats} />

      {/* 快速開始 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <SectionHeader chip="Quick Start" title="快速開始" />
        <QuickStart items={quickStart} />
      </section>

      {/* 角色 */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <SectionHeader
            chip="Characters"
            title="角色"
            action={{ href: "/post/角色篇/角色目錄/", label: "查看角色目錄 View All" }}
          />
          <CharacterGrid posts={characters} />
        </div>
      </section>

      {/* 系統 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <SectionHeader chip="Systems" title="系統" />
        <SystemCards overview={systemOverview} items={systemItems} />
      </section>

      {/* 副本 */}
      {dungeonLead ? (
        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <SectionHeader
              chip="Dungeons"
              title="副本"
              action={{ href: dungeonLead.url, label: "副本篇 Raid Guide" }}
            />
            <DungeonSection lead={dungeonLead} dungeons={dungeons} />
          </div>
        </section>
      ) : null}

      {/* 最新更新 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <SectionHeader
          chip="Recent Updates"
          title="最新更新"
          action={{ href: "/archives/", label: "所有文章 Archives" }}
        />
        <div className="grid gap-5 xl:grid-cols-2">
          {recent.map((p: PostMeta) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </section>
    </>
  );
}
