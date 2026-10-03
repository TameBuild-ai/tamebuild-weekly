// Loads and validates issues and editorials from content/.
//
// Issues:     content/issues/YYYY-MM-DD.md, written by the engine.
// Editorials: content/editorials/<slug>.md, written by hand.
//
// Every rule here fails the build rather than warning. A failed build leaves
// the last good deploy live, which is the right outcome for a page that would
// otherwise ship with an em dash, a missing byline or a malformed date.

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parseFrontMatter } from "./frontmatter.mjs";

export const EM_DASH = "—";

const ROOT = new URL("../", import.meta.url);
const ISSUES_DIR = new URL("content/issues/", ROOT);
const EDITORIALS_DIR = new URL("content/editorials/", ROOT);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

marked.setOptions({ gfm: true, breaks: false });

export function assertNoEmDash(text, where) {
  const i = text.indexOf(EM_DASH);
  if (i === -1) return;
  const line = text.slice(0, i).split("\n").length;
  throw new Error(`${where}: em dash (U+2014) on line ${line}. Rewrite the sentence; the site never uses that character.`);
}

function assertDate(value, where) {
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value + "T00:00:00Z"))) {
    throw new Error(`${where}: "${value}" is not a YYYY-MM-DD date`);
  }
}

export function formatDate(iso, { short = false } = {}) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: short ? "short" : "long",
    day: "numeric",
    year: "numeric",
  });
}

function listMarkdown(dirUrl) {
  if (!fs.existsSync(dirUrl)) return [];
  return fs
    .readdirSync(dirUrl)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_") && f.toLowerCase() !== "readme.md")
    .sort();
}

// "**1. Headline**" on its own line is how the engine (and Issue 1) marks an
// item. It becomes an h2 so the page has real structure.
const ITEM_HEADLINE = /^\*\*(\d+)\.\s+(.+?)\*\*\s*$/;
const TITLE_LINE = /^\*\*(Tame the Week:[^*]+)\*\*\s*$/;

function stripInline(md) {
  return md.replace(/\*\*|__|\*|_|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

export function parseIssueBody(body, where) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let title = null;
  const out = [];
  const headlines = [];
  for (const line of lines) {
    if (title === null && !out.some((l) => l.trim()) && TITLE_LINE.test(line)) {
      title = line.match(TITLE_LINE)[1].trim();
      continue;
    }
    const h = line.match(ITEM_HEADLINE);
    if (h) {
      headlines.push(stripInline(h[2]));
      out.push(`## ${h[1]}. ${h[2]}`);
      continue;
    }
    out.push(line);
  }
  const markdown = out.join("\n").trim() + "\n";
  // The opening sentence is the first paragraph before the first item.
  const firstItem = out.findIndex((l) => l.startsWith("## "));
  const intro = out
    .slice(0, firstItem === -1 ? out.length : firstItem)
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find(Boolean);
  if (!headlines.length) throw new Error(`${where}: no "**1. Headline**" items found`);
  return { title, markdown, headlines, intro: intro ? stripInline(intro) : "" };
}

export function loadIssues() {
  const issues = listMarkdown(ISSUES_DIR).map((file) => {
    const where = `content/issues/${file}`;
    const src = fs.readFileSync(new URL(file, ISSUES_DIR), "utf8");
    assertNoEmDash(src, where);
    const { data, body } = parseFrontMatter(src, where);
    const date = path.basename(file, ".md");
    assertDate(date, where);
    if (data.date && data.date !== date) throw new Error(`${where}: front matter date ${data.date} does not match the file name`);
    for (const k of ["window_start", "window_end"]) if (data[k] !== undefined) assertDate(data[k], `${where} ${k}`);
    const parsed = parseIssueBody(body, where);
    return {
      kind: "issue",
      date,
      slug: date,
      path: `/${date}/`,
      title: parsed.title || `Tame the Week: ${formatDate(date)}`,
      headline: data.headline || parsed.headlines[0],
      headlines: parsed.headlines,
      summary: data.summary || parsed.intro,
      windowStart: data.window_start || null,
      windowEnd: data.window_end || null,
      html: marked.parse(parsed.markdown),
    };
  });
  issues.forEach((issue, i) => (issue.number = i + 1)); // sorted ascending by file name
  return issues;
}

export function loadEditorials() {
  return listMarkdown(EDITORIALS_DIR).map((file) => {
    const where = `content/editorials/${file}`;
    const src = fs.readFileSync(new URL(file, EDITORIALS_DIR), "utf8");
    assertNoEmDash(src, where);
    const { data, body } = parseFrontMatter(src, where);
    const slug = path.basename(file, ".md");
    if (!SLUG_RE.test(slug)) throw new Error(`${where}: file name must be lowercase words joined by hyphens, like my-first-editorial.md`);
    for (const k of ["title", "author", "bio", "date", "summary"]) {
      if (typeof data[k] !== "string" || !data[k].trim()) throw new Error(`${where}: front matter needs "${k}"`);
    }
    assertDate(data.date, where);
    if (data.email !== undefined && typeof data.email !== "boolean") throw new Error(`${where}: email must be true or false`);
    if (!body.trim()) throw new Error(`${where}: the editorial has no body`);
    return {
      kind: "editorial",
      date: data.date,
      slug,
      path: `/editorial/${slug}/`,
      title: data.title,
      author: data.author,
      bio: data.bio,
      summary: data.summary,
      email: data.email !== false,
      html: marked.parse(body),
    };
  });
}
