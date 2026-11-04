import assert from "node:assert/strict";
import test from "node:test";
import { articlesFromBlogIndex, buildFeed, parsePost } from "../src/feed.mjs";

const page = `<html><head>
<meta property="og:title" content="Fast &amp; Easy | Flowdeck">
<meta property="og:description" content="It&#39;s &quot;fast&quot;">
<meta property="og:image" content="https://img.example/a.jpg?width=1&amp;height=2">
</head></html>`;
const date = new Date("2026-10-06T00:00:00.000Z");

test("parsePost reads Open Graph tags, decodes entities, and strips the site suffix", () => {
  const post = parsePost({ url: "https://s.test/blog/a", date }, page, "Flowdeck");
  assert.equal(post.title, "Fast & Easy");
  assert.equal(post.description, `It's "fast"`);
  assert.equal(post.image, "https://img.example/a.jpg?width=1&height=2");
  assert.equal(post.date, date);
});

test("parsePost falls back to the meta description and returns null without a title", () => {
  const html = `<meta property="og:title" content="T"><meta name="description" content="D">`;
  assert.equal(parsePost({ url: "u", date }, html, "Flowdeck").description, "D");
  assert.equal(parsePost({ url: "u", date }, "<html></html>", "Flowdeck"), null);
});

test("articlesFromBlogIndex returns each linked article once with its card date, ignoring other links", () => {
  const html = `
<a href="./blog/newer"><h3>Newer</h3></a><span>Oct 29, 2026</span>
<a href="./blog/newer"><h3>Newer</h3></a><span>Oct 29, 2026</span>
<a href="./blog/older?x=1#y">Older</a><p>Apr 1, 2026</p>
<a href="./blog/no-date">No date</a>
<a href="./learn/videos">Videos</a>
<a href="./blog/after">After</a><span>Mar 2, 2026</span>`;
  const articles = articlesFromBlogIndex(html, "https://s.test");
  assert.deepEqual(
    articles.map((a) => [a.url, a.date.toISOString()]),
    [
      ["https://s.test/blog/newer", "2026-10-29T00:00:00.000Z"],
      ["https://s.test/blog/older", "2026-04-01T00:00:00.000Z"],
      ["https://s.test/blog/after", "2026-03-02T00:00:00.000Z"],
    ],
  );
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
