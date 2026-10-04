// The page shell shared by the static build and the functions (signup, confirm
// and hold pages), so every page carries the same header and footer as
// tamebuild.ai.
//
// Header and footer are copied from tamebuild.ai's index.html. Links to the
// main site are absolute: through the /weekly proxy a root-relative link would
// work, but on the netlify.app address it would point at nothing.

import { getConfig, publicUrl } from "./config.mjs";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

function header() {
  return `<header>
  <nav class="wrap">
    <div class="brand"><a href="https://tamebuild.ai/" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:8px;"><span class="dot">&#9670;</span> TAMEBUILD<span style="color:var(--brass)">.AI</span></a></div>
    <div class="navlinks">
      <a href="https://tamebuild.ai/">Home</a>
      <a href="https://tamebuild.ai/self-service">Reports</a>
      <a href="https://tamebuild.ai/#services">Services</a>
      <a href="https://tamebuild.ai/real-estate">Real Estate</a>
      <a href="/weekly/" class="current">AI News</a>
      <a href="https://tamebuild.ai/#contact">Contact</a>
    </div>
    <div class="navlocation">UNION CITY, TN</div>
  </nav>
</header>`;
}

function footer() {
  const c = getConfig();
  return `<footer>
  <div class="wrap foot-row">
    <div>&copy; ${new Date().getUTCFullYear()} TameBuild.AI. Jeff Goddard, Union City, TN<br>${esc(c.mailingAddress)}</div>
    <div><a href="/weekly/feed.xml">RSS</a> &nbsp; <a href="mailto:${esc(c.replyTo)}">${esc(c.replyTo)}</a></div>
  </div>
</footer>`;
}

/**
 * @param {object} o
 * @param {string} o.title        full <title>
 * @param {string} o.description  meta description and social description
 * @param {string} [o.path]       path under /weekly for canonical and og:url
 * @param {string} [o.ogType]     "website" or "article"
 * @param {boolean} [o.noindex]   for function-rendered utility pages
 * @param {string} o.body         HTML inside <main>
 */
export function page({ title, description, path, ogType = "website", noindex = false, body, published }) {
  const c = getConfig();
  const canonical = path ? publicUrl(path) : null;
  const image = publicUrl("/assets/og.png");
  const meta = [
    `<meta name="description" content="${esc(description)}">`,
    canonical && `<link rel="canonical" href="${esc(canonical)}">`,
    noindex && `<meta name="robots" content="noindex">`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(c.shortTitle)}" href="${esc(publicUrl("/feed.xml"))}">`,
    `<meta property="og:site_name" content="${esc(c.shortTitle)}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    canonical && `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    published && `<meta property="article:published_time" content="${esc(published)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${meta}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/weekly/assets/style.css">
<link rel="stylesheet" href="/weekly/assets/weekly.css">
</head>
<body>

${header()}

<main>
${body}
</main>

${footer()}

</body>
</html>
`;
}

// Small utility page used by the functions: one heading, a few sentences,
// optionally a single-button form, optionally an inline script (the confirm
// page uses one to submit itself).
export function messagePage({ title, heading, paragraphs = [], form = null, status = 200, script = "" }) {
  const c = getConfig();
  const formHtml = form
    ? `<form method="post" action="${esc(form.action)}" class="msg-form">
${Object.entries(form.fields || {})
  .map(([k, v]) => `  <input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
  .join("\n")}
  <button class="btn" type="submit">${esc(form.button)}</button>
</form>`
    : "";
  const html = page({
    title: `${title} | ${c.shortTitle}`,
    description: c.description,
    noindex: true,
    body: `<section class="msg blueprint-bg"><div class="wrap">
  <div class="eyebrow">${esc(c.shortTitle)}</div>
  <h1 class="msg-title" id="msg-heading">${esc(heading)}</h1>
  <div id="msg-body">
  ${paragraphs.map((p) => `<p class="lede">${p}</p>`).join("\n  ")}
  ${formHtml}
  </div>
  <p><a class="seelink" href="/weekly/">Back to Tame the Week</a></p>
</div></section>${script ? `\n<script>\n${script}\n</script>` : ""}`,
  });
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
