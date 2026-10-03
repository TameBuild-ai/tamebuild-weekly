import { getConfig, publicUrl } from "./config.mjs";
import { esc, page } from "./layout.mjs";
import { formatDate } from "./content.mjs";

export function signupBlock(id) {
  return `<section class="signup" aria-labelledby="${id}-label">
  <form class="signup-form" method="post" action="/weekly/api/subscribe">
    <label id="${id}-label" for="${id}-email">Get it by email every Monday</label>
    <div class="signup-row">
      <input type="email" name="email" id="${id}-email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbusiness.com">
      <button class="btn" type="submit">Subscribe</button>
    </div>
    <div class="hp-field" aria-hidden="true">
      <label for="${id}-website">Leave this empty</label>
      <input type="text" name="website" id="${id}-website" tabindex="-1" autocomplete="off">
    </div>
    <p class="fine">Free. One short email a week, plus an occasional editorial. We'll send a link to confirm, and every email has an unsubscribe link.</p>
  </form>
</section>`;
}

function issueMeta(issue) {
  const c = getConfig();
  const window =
    issue.windowStart && issue.windowEnd
      ? ` &middot; News from ${esc(formatDate(issue.windowStart, { short: true }))} to ${esc(formatDate(issue.windowEnd, { short: true }))}`
      : "";
  return `<p class="issue-meta">Issue ${issue.number} &middot; By ${esc(c.author)}${window}</p>`;
}

function issueArticle(issue, { headingTag = "h1", link = false } = {}) {
  const title = link ? `<a href="/weekly${issue.path}">${esc(issue.title)}</a>` : esc(issue.title);
  return `<article class="issue">
  <${headingTag} class="issue-title">${title}</${headingTag}>
  ${issueMeta(issue)}
  <div class="prose issue-body">
${issue.html}
  </div>
</article>`;
}

function listItem(entry) {
  const label = entry.kind === "issue" ? entry.headline : entry.title;
  const sub = entry.kind === "issue" ? `Issue ${entry.number}` : `By ${esc(entry.author)}`;
  return `<li><a href="/weekly${entry.path}"><span class="li-date">${esc(formatDate(entry.date, { short: true }))}</span><span class="li-title">${esc(label)}</span><span class="li-sub">${sub}</span></a></li>`;
}

export function indexPage({ issues, editorials }) {
  const c = getConfig();
  const newestFirst = [...issues].reverse();
  const latest = newestFirst[0];
  const older = newestFirst.slice(1);
  const eds = [...editorials].sort((a, b) => b.date.localeCompare(a.date));

  const body = `<section class="weekly-hero blueprint-bg">
  <div class="wrap">
    <div class="eyebrow">Every Monday &middot; Free</div>
    <h1>Tame the Week <em>AI news for small business</em></h1>
    <p class="lede">Two or three things that happened in AI each week, and what each one means if you run a shop, an office or a few rentals. Every item is checked against its source before it goes out.</p>
    ${signupBlock("top")}
  </div>
</section>

<section class="weekly-latest">
  <div class="wrap">
    <div class="dim-divider"><span class="tick">&#9670;</span><span class="label">Latest issue</span><span class="rule"></span></div>
    ${latest ? issueArticle(latest, { headingTag: "h2", link: true }) : "<p>The first issue is on its way.</p>"}
  </div>
</section>

${
  older.length
    ? `<section class="weekly-list">
  <div class="wrap">
    <div class="dim-divider"><span class="tick">&#9670;</span><span class="label">Archive</span><span class="rule"></span></div>
    <ul class="entry-list">${older.map(listItem).join("\n")}</ul>
  </div>
</section>`
    : ""
}

${
  eds.length
    ? `<section class="weekly-list">
  <div class="wrap">
    <div class="dim-divider"><span class="tick">&#9670;</span><span class="label">Editorials</span><span class="rule"></span></div>
    <ul class="entry-list">${eds.map(listItem).join("\n")}</ul>
  </div>
</section>`
    : ""
}

<section class="weekly-bottom">
  <div class="wrap">${signupBlock("bottom")}</div>
</section>`;

  return page({ title: c.title, description: c.description, path: "/", body });
}

export function issuePage(issue, { prev, next }) {
  const c = getConfig();
  const nav = [
    prev && `<a class="seelink" href="/weekly${prev.path}">Previous issue</a>`,
    `<a class="seelink" href="/weekly/">All issues</a>`,
    next && `<a class="seelink" href="/weekly${next.path}">Next issue</a>`,
  ]
    .filter(Boolean)
    .join("");
  const body = `<section class="weekly-article">
  <div class="wrap">
    <div class="eyebrow"><a href="/weekly/" class="eyebrow-link">${esc(c.shortTitle)}</a></div>
    ${issueArticle(issue)}
    <nav class="pager" aria-label="More issues">${nav}</nav>
    ${signupBlock("bottom")}
  </div>
</section>`;
  return page({
    title: `${issue.headline} | ${c.shortTitle}`,
    description: issue.summary || c.description,
    path: issue.path,
    ogType: "article",
    published: issue.date,
    body,
  });
}

export function editorialPage(ed) {
  const c = getConfig();
  const body = `<section class="weekly-article">
  <div class="wrap">
    <div class="eyebrow"><a href="/weekly/" class="eyebrow-link">${esc(c.shortTitle)}</a> &middot; Editorial</div>
    <article class="issue editorial">
      <h1 class="issue-title">${esc(ed.title)}</h1>
      <p class="issue-meta">By ${esc(ed.author)} &middot; ${esc(formatDate(ed.date))}</p>
      <div class="prose issue-body">
${ed.html}
      </div>
      <aside class="byline-box"><p class="byline-name">${esc(ed.author)}</p><p>${esc(ed.bio)}</p></aside>
    </article>
    <nav class="pager" aria-label="More"><a class="seelink" href="/weekly/">All issues and editorials</a></nav>
    ${signupBlock("bottom")}
  </div>
</section>`;
  return page({
    title: `${ed.title} | ${c.shortTitle}`,
    description: ed.summary,
    path: ed.path,
    ogType: "article",
    published: ed.date,
    body,
  });
}

// Root-relative links inside content become absolute for the feed, where a
// reader has no base URL to resolve them against.
function absolutize(html) {
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${getConfig().siteUrl}/`);
}

function rfc822(iso) {
  // Publication is 10 AM Central; 15:00 UTC is close enough for a feed date.
  return new Date(iso + "T15:00:00Z").toUTCString();
}

export function feed({ issues, editorials }) {
  const c = getConfig();
  const entries = [...issues, ...editorials].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "issue" ? -1 : 1));
  const items = entries
    .map((e) => {
      const url = publicUrl(e.path);
      const title = e.kind === "issue" ? `${c.shortTitle}: ${e.headline}` : e.title;
      const content =
        e.kind === "issue" ? e.html : `${e.html}\n<p><em>${esc(e.author)}: ${esc(e.bio)}</em></p>`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${rfc822(e.date)}</pubDate>
      <dc:creator>${esc(e.kind === "issue" ? c.author : e.author)}</dc:creator>
      <description>${esc(e.summary || "")}</description>
      <content:encoded><![CDATA[${absolutize(content).replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(c.title)}</title>
    <link>${esc(publicUrl("/"))}</link>
    <atom:link href="${esc(publicUrl("/feed.xml"))}" rel="self" type="application/rss+xml"/>
    <description>${esc(c.description)}</description>
    <language>en-us</language>
${entries.length ? `    <lastBuildDate>${rfc822(entries[0].date)}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
}

export function sitemap({ issues, editorials }) {
  const urls = [
    { loc: publicUrl("/"), lastmod: [...issues, ...editorials].map((e) => e.date).sort().pop() },
    ...issues.map((i) => ({ loc: publicUrl(i.path), lastmod: i.date })),
    ...editorials.map((e) => ({ loc: publicUrl(e.path), lastmod: e.date })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
}
