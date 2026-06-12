/** Dev utility: renders representative posts to verify the markdown pipeline. */
import { getAllPosts, getPost, getCategories, getTags } from "../lib/content";

async function main() {
  const posts = getAllPosts();
  console.log(`posts: ${posts.length}`);
  console.log("order head:", posts.slice(0, 3).map((p) => `${p.title} (w=${p.weight}) ${p.url}`));

  const qianyan = await getPost(["前言"]);
  console.log("\n=== 前言 (callout + card + image) ===\n");
  console.log(qianyan?.html);

  const rukeng = await getPost(["入坑前"]);
  const mdLinks = rukeng?.html.match(/<a [^>]*href="[^"]*"[^>]*>/g)?.slice(0, 12);
  console.log("\n=== 入坑前 link resolution ===\n", mdLinks);

  const dungeon = await getPost(["副本", "主要副本", "必然災禍"]);
  console.log("\n=== 必然災禍 toc ===\n", dungeon?.toc.slice(0, 8));
  console.log("youtube embeds:", (dungeon?.html.match(/video-embed/g) || []).length);

  console.log("\ncategories:", getCategories().map((c) => `${c.name}→${c.slug}(${c.posts.length})`).join(" "));
  console.log("\ntags count:", getTags().length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
