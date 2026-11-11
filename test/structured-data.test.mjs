// Article structured data (JSON-LD) on every issue and editorial page, checked
// against the built output and the sitemap (SEO write-up, 2026-11-02).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadIssues, loadEditorials } from "../lib/content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist", "weekly");
const PUBLIC = "https://tamebuild.ai/weekly";

const built = spawnSync(process.execPath, ["build.mjs"], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) throw new Error(`build failed: ${built.stderr}`);

const unesc = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function fileFor(url) {
  return path.join(OUT, url.slice(PUBLIC.length), "index.html");
}

const sitemap = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => ({ url: m[1], lastmod: m[2] }));
const INDEXES = [`${PUBLIC}/`, `${PUBLIC}/editorial/`];
const articles = entries.filter((e) => !INDEXES.includes(e.url));

function head(html) {
  return html.slice(0, html.indexOf("</head>"));
}
function blocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
function meta(html, re) {
  const m = head(html).match(re);
  return m ? unesc(m[1]) : null;
}

test("every issue and editorial page has exactly one JSON-LD block in its head, and it is an Article", () => {
  assert.ok(articles.length > 0, "the sitemap lists issue and editorial pages");
  assert.equal(articles.length, loadIssues().length + loadEditorials().length, "one sitemap entry per issue and editorial");
  for (const { url } of articles) {
    const html = fs.readFileSync(fileFor(url), "utf8");
    const all = blocks(html);
    assert.equal(all.length, 1, `${url}: one JSON-LD block`);
    assert.equal(blocks(head(html)).length, 1, `${url}: the block is in <head>`);
    const data = JSON.parse(all[0]);
    assert.equal(data["@context"], "https://schema.org", url);
    assert.equal(data["@type"], "Article", url);
  }
});

test("each Article matches its page's canonical, meta description, og tags, byline and sitemap date", () => {
  assert.ok(articles.length > 0);
  for (const { url, lastmod } of articles) {
    const html = fs.readFileSync(fileFor(url), "utf8");
    const data = JSON.parse(blocks(html)[0]);
    const canonical = meta(html, /<link rel="canonical" href="([^"]*)">/);
    assert.equal(canonical, url, `${url}: canonical`);
    assert.equal(data.mainEntityOfPage, canonical, `${url}: mainEntityOfPage`);
    assert.equal(data.url, canonical, `${url}: url`);
    assert.equal(data.description, meta(html, /<meta name="description" content="([^"]*)">/), `${url}: description`);
    assert.equal(data.datePublished, lastmod, `${url}: datePublished`);
    assert.equal(data.dateModified, data.datePublished, `${url}: dateModified`);
    assert.equal(data.headline, meta(html, /<meta property="og:title" content="([^"]*)">/).replace(/ \| Tame the Week$/, ""), `${url}: headline`);
    assert.ok(data.headline.length <= 110, `${url}: headline at most 110 characters`);
    assert.equal(data.image, meta(html, /<meta property="og:image" content="([^"]*)">/), `${url}: image`);
    const byline = html.match(/<p class="issue-meta">[^<]*?By ([^&<]+?)(?: &middot;|<)/)[1];
    assert.deepEqual(data.author, { "@type": "Person", name: unesc(byline), url: "https://tamebuild.ai/" }, `${url}: author`);
    assert.deepEqual(data.publisher, { "@type": "Organization", name: "TameBuild", url: "https://tamebuild.ai/" }, `${url}: publisher`);
    assert.deepEqual(data.isPartOf, { "@type": "Periodical", name: "Tame the Week", url: `${PUBLIC}/` }, `${url}: isPartOf`);
  }
});

test("the index pages carry no Article block", () => {
  for (const url of INDEXES) {
    const html = fs.readFileSync(fileFor(url), "utf8");
    assert.ok(html.includes("<html"), `${url} was built`);
    assert.ok(!blocks(html).some((b) => JSON.parse(b)["@type"] === "Article"), `${url}: no Article`);
  }
});

test("every page footer carries the phone number and the privacy link, like the rest of tamebuild.ai", () => {
  const pages = [...entries.map((e) => fileFor(e.url))];
  assert.ok(pages.length > 2);
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const footer = html.slice(html.indexOf("<footer>"), html.indexOf("</footer>"));
    assert.ok(footer.includes('<a href="tel:+17315076677">(731) 507-6677</a>'), `${file}: phone`);
    assert.ok(footer.includes('<a href="https://tamebuild.ai/privacy">Privacy</a>'), `${file}: privacy`);
  }
});
