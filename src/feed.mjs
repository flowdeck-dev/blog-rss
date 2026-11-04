const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export const escapeXml = (value) => value.replace(/[&<>"']/g, (c) => ENTITIES[c]);

const decodeHtml = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const metaContent = (html, attr, key) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!new RegExp(`${attr}=["']${key}["']`, "i").test(tag)) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i);
    if (content) return decodeHtml(content[1]);
  }
  return "";
};

// Framer emits a <time datetime> for the post date and no article:published_time.
// JSON-LD is kept as a fallback in case the template changes.
const publishedDate = (html) => {
  const raw =
    html.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1] ??
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const stripSiteSuffix = (title, siteName) =>
  title.replace(new RegExp(`\\s*[|\\-–]\\s*${siteName}\\s*$`, "i"), "");

/** Returns null when the page is not a dated blog post. */
export function parsePost(url, html, siteName) {
  const date = publishedDate(html);
  const title = stripSiteSuffix(metaContent(html, "property", "og:title"), siteName);
  if (!date || !title) return null;
  return {
    url,
    title,
    description:
      metaContent(html, "property", "og:description") || metaContent(html, "name", "description"),
    image: metaContent(html, "property", "og:image"),
    date,
  };
}

/** Blog post URLs from a sitemap, excluding the blog index itself. */
export function blogUrlsFromSitemap(xml, siteUrl) {
  const prefix = `${siteUrl}/blog/`;
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(urls.filter((u) => u.startsWith(prefix) && u.length > prefix.length))];
}

export function buildFeed({ siteUrl, feedUrl, title, description, language, posts, now }) {
  const sorted = [...posts].sort((a, b) => b.date - a.date);
  const items = sorted
    .map((p) => {
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(p.url)}</link>
      <guid isPermaLink="true">${escapeXml(p.url)}</guid>
      <description>${escapeXml(p.description)}</description>
      <pubDate>${p.date.toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  // lastBuildDate follows the newest post so an unchanged blog yields a byte-identical feed
  // and the scheduled job commits nothing.
  const lastBuild = sorted[0]?.date ?? now;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>${language}</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
