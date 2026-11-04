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

const stripSiteSuffix = (title, siteName) =>
  title.replace(new RegExp(`\\s*[|\\-–]\\s*${siteName}\\s*$`, "i"), "");

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_TEXT = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}), (20\d\d)\b/;

/**
 * Articles listed on the blog index, newest first as shown. The index is the source of truth:
 * /learn guides also live under /blog/ URLs and sitemap.xml cannot tell them apart. Each card's
 * date is the first date text after its link.
 */
export function articlesFromBlogIndex(html, siteUrl) {
  const links = [...html.matchAll(/href="\.\/blog\/([^"#?]+)[^"]*"/g)];
  const articles = new Map();
  links.forEach((link, i) => {
    const url = `${siteUrl}/blog/${link[1]}`;
    if (articles.has(url)) return;
    // A card repeats its link, so the date belongs to the text before the next different article.
    const next = links.slice(i + 1).find((l) => l[1] !== link[1]);
    const match = html.slice(link.index, next?.index ?? html.length).match(DATE_TEXT);
    if (!match) return;
    const month = MONTHS.indexOf(match[1].toLowerCase());
    articles.set(url, new Date(Date.UTC(Number(match[3]), month, Number(match[2]))));
  });
  return [...articles].map(([url, date]) => ({ url, date }));
}

/** Returns null when the page has no title. */
export function parsePost({ url, date }, html, siteName) {
  const title = stripSiteSuffix(metaContent(html, "property", "og:title"), siteName);
  if (!title) return null;
  return {
    url,
    title,
    description:
      metaContent(html, "property", "og:description") || metaContent(html, "name", "description"),
    image: metaContent(html, "property", "og:image"),
    date,
  };
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
