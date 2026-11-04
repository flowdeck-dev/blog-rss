import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { articlesFromBlogIndex, buildFeed, parsePost } from "../src/feed.mjs";
import { get } from "../src/http.mjs";

const SITE_URL = "https://flowdeck.studio";
const SITE_NAME = "Flowdeck";
const FEED_URL = process.env.FEED_URL ?? "https://feed.flowdeck.studio/rss.xml";
const OUTPUT = "public/rss.xml";
const BATCH_SIZE = 5;

const articles = articlesFromBlogIndex(await get(`${SITE_URL}/blog`), SITE_URL);
if (articles.length === 0) throw new Error("Blog index lists no articles; refusing to overwrite the feed");

const posts = [];
for (let i = 0; i < articles.length; i += BATCH_SIZE) {
  const results = await Promise.allSettled(
    articles.slice(i, i + BATCH_SIZE).map(async (a) => parsePost(a, await get(a.url), SITE_NAME)),
  );
  results.forEach((r, j) => {
    const url = articles[i + j].url;
    if (r.status === "rejected") console.warn(`skip ${url}: ${r.reason.message}`);
    else if (r.value === null) console.warn(`skip ${url}: no title`);
    else posts.push(r.value);
  });
}
if (posts.length === 0) throw new Error("No posts parsed; refusing to overwrite the feed");

const xml = buildFeed({
  siteUrl: SITE_URL,
  feedUrl: FEED_URL,
  title: `${SITE_NAME} Blog`,
  description: "Guides and news on building iOS and macOS apps with AI agents and FlowDeck.",
  language: "en-US",
  posts,
  now: new Date(),
});
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, xml);
console.log(`Wrote ${posts.length} posts to ${OUTPUT}`);
