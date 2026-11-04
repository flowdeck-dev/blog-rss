# blog-rss

Generates an RSS 2.0 feed for the FlowDeck blog (https://flowdeck.studio/blog). Framer CMS has no RSS output, so the generator reads the article list and dates from the `/blog` index (not the sitemap, which mixes in `/learn` guides that also live under `/blog/` URLs), scrapes each article's Open Graph tags, and writes `public/rss.xml`.

A scheduled GitHub Actions workflow (`generate-feed.yml`, daily 01:30 UTC, or run it manually) regenerates the file and commits it only when it changed. The same workflow deploys `public/` to GitHub Pages, served at `feed.flowdeck.studio` (CNAME to `flowdeck-dev.github.io`).

```sh
npm test            # unit tests
npm run generate    # writes public/rss.xml from the live site
FEED_URL=... npm run generate   # override the feed's self URL
```

## Hooking it into the Framer site

1. Point `feed.flowdeck.studio` at the static host (CNAME) and add the domain there.
2. In Framer, add to Site Settings > Custom Code > Start of `<head>`:
   `<link rel="alternate" type="application/rss+xml" title="Flowdeck Blog" href="https://feed.flowdeck.studio/rss.xml">`
3. Optionally add a visible RSS link on the blog page pointing to the same URL.
4. Validate with https://validator.w3.org/feed/.

