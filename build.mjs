// Static build for tamebuild.ai/weekly.
//
//   npm run build   writes dist/
//   npm run check   validates content only (use before committing an editorial)
//
// Everything is emitted under dist/weekly/ so paths are identical on the
// netlify.app address and behind the tamebuild.ai proxy
// (/weekly/* -> https://<site>.netlify.app/weekly/:splat).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIssues, loadEditorials, assertNoEmDash } from "./lib/content.mjs";
import { indexPage, issuePage, editorialPage, feed, sitemap } from "./lib/templates.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "weekly");
const checkOnly = process.argv.includes("--check");

const issues = loadIssues();
const editorials = loadEditorials();

const slugs = new Set();
for (const e of editorials) {
  if (slugs.has(e.slug)) throw new Error(`Two editorials share the slug ${e.slug}`);
  slugs.add(e.slug);
}

console.log(`Content OK: ${issues.length} issue(s), ${editorials.length} editorial(s).`);
if (checkOnly) process.exit(0);

const files = new Map();
files.set("index.html", indexPage({ issues, editorials }));
issues.forEach((issue, i) => {
  files.set(`${issue.date}/index.html`, issuePage(issue, { prev: issues[i - 1], next: issues[i + 1] }));
});
for (const ed of editorials) files.set(`editorial/${ed.slug}/index.html`, editorialPage(ed));
files.set("feed.xml", feed({ issues, editorials }));
files.set("sitemap.xml", sitemap({ issues, editorials }));

fs.rmSync(DIST, { recursive: true, force: true });
for (const [rel, content] of files) {
  assertNoEmDash(content, `generated ${rel}`);
  const target = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

// Static assets, checked for the same character as the pages.
const ASSETS = path.join(ROOT, "assets");
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
for (const name of fs.readdirSync(ASSETS)) {
  const buf = fs.readFileSync(path.join(ASSETS, name));
  if (/\.(css|js|svg|txt|html)$/.test(name)) assertNoEmDash(buf.toString("utf8"), `assets/${name}`);
  fs.writeFileSync(path.join(OUT, "assets", name), buf);
}

// The netlify.app root has nothing of its own; send it to the weekly index.
fs.writeFileSync(path.join(DIST, "_redirects"), "/  /weekly/  302\n");
fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://tamebuild.ai/weekly/sitemap.xml\n");

console.log(`Wrote ${files.size} pages and feeds to dist/weekly/.`);
