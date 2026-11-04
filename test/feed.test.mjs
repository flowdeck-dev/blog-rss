import assert from "node:assert/strict";
import test from "node:test";
import { blogUrlsFromSitemap, buildFeed, parsePost } from "../src/feed.mjs";

const page = (extra = "") => `<html><head>
<meta property="og:title" content="Fast &amp; Easy | Flowdeck">
<meta property="og:description" content="It&#39;s &quot;fast&quot;">
<meta property="og:image" content="https://img.example/a.jpg?width=1&amp;height=2">
${extra}</head><body><time datetime="2026-10-06T00:00:00.000Z">Oct 6, 2026</time></body></html>`;

test("parsePost reads Open Graph tags, decodes entities, and strips the site suffix", () => {
  const post = parsePost("https://s.test/blog/a", page(), "Flowdeck");
  assert.equal(post.title, "Fast & Easy");
  assert.equal(post.description, `It's "fast"`);
  assert.equal(post.image, "https://img.example/a.jpg?width=1&height=2");
  assert.equal(post.date.toISOString(), "2026-10-06T00:00:00.000Z");
});

test("parsePost falls back to JSON-LD datePublished", () => {
  const html = `<meta property="og:title" content="T">
<script type="application/ld+json">{"datePublished":"2026-01-02T03:04:05Z"}</script>`;
  assert.equal(parsePost("u", html, "Flowdeck").date.toISOString(), "2026-01-02T03:04:05.000Z");
});

test("parsePost returns null for pages without a date or title", () => {
  assert.equal(parsePost("u", `<meta property="og:title" content="T">`, "Flowdeck"), null);
  assert.equal(parsePost("u", `<time datetime="2026-01-01">x</time>`, "Flowdeck"), null);
});

test("blogUrlsFromSitemap keeps blog posts only, without the index or duplicates", () => {
  const xml = `<urlset>
<url><loc>https://s.test/blog</loc></url>
<url><loc>https://s.test/blog/</loc></url>
<url><loc>https://s.test/blog/a</loc></url>
<url><loc>https://s.test/blog/a</loc></url>
<url><loc>https://s.test/changelog/x</loc></url>
<url><loc>https://www.s.test/blog/b</loc></url></urlset>`;
  assert.deepEqual(blogUrlsFromSitemap(xml, "https://s.test"), ["https://s.test/blog/a"]);
});

const feedInput = (posts) => ({
  siteUrl: "https://s.test",
  feedUrl: "https://feed.s.test/rss.xml",
  title: "S & Blog",
  description: "d",
  language: "en-US",
  posts,
  now: new Date("2030-01-01T00:00:00Z"),
});

test("buildFeed orders newest first and escapes XML", () => {
  const xml = buildFeed(
    feedInput([
      { url: "https://s.test/blog/old", title: "Old", description: "", image: "", date: new Date("2026-01-01T00:00:00Z") },
      { url: "https://s.test/blog/new", title: "A <b> & C", description: "x", image: "https://i/a?w=1&h=2", date: new Date("2026-02-01T00:00:00Z") },
    ]),
  );
  assert.ok(xml.indexOf("blog/new") < xml.indexOf("blog/old"));
  assert.match(xml, /<title>S &amp; Blog<\/title>/);
  assert.match(xml, /<title>A &lt;b&gt; &amp; C<\/title>/);
  assert.match(xml, /<atom:link href="https:\/\/feed\.s\.test\/rss\.xml" rel="self"/);
  assert.match(xml, /<pubDate>Sun, 01 Feb 2026 00:00:00 GMT<\/pubDate>/);
});

test("buildFeed is byte-identical across runs when posts are unchanged", () => {
  const posts = [{ url: "https://s.test/blog/a", title: "A", description: "", image: "", date: new Date("2026-02-01T00:00:00Z") }];
  const first = buildFeed(feedInput(posts));
  const second = buildFeed({ ...feedInput(posts), now: new Date("2031-05-05T00:00:00Z") });
  assert.equal(first, second);
});
