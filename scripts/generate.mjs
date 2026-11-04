import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { blogUrlsFromSitemap, buildFeed, parsePost } from "../src/feed.mjs";
import { get } from "../src/http.mjs";

const SITE_URL = "https://flowdeck.studio";
const SITE_NAME = "Flowdeck";
const FEED_URL = process.env.FEED_URL ?? "https://feed.flowdeck.studio/rss.xml";
const OUTPUT = "public/rss.xml";
const BATCH_SIZE = 5;

const sitemap = await get(`${SITE_URL}/sitemap.xml`);
const urls = blogUrlsFromSitemap(sitemap, SITE_URL);
if (urls.length === 0) throw new Error("Sitemap has no blog URLs; refusing to overwrite the feed");

const posts = [];
for (let i = 0; i < urls.length; i += BATCH_SIZE) {
  const results = await Promise.allSettled(
    urls.slice(i, i + BATCH_SIZE).map(async (url) => parsePost(url, await get(url), SITE_NAME)),
  );
  results.forEach((r, j) => {
    const url = urls[i + j];
    if (r.status === "rejected") console.warn(`skip ${url}: ${r.reason.message}`);
    else if (r.value === null) console.warn(`skip ${url}: not a dated post`);
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
