import test from "node:test";
import assert from "node:assert/strict";
import { loadIssues, loadEditorials } from "../lib/content.mjs";
import { externalLinksNewTab, indexPage, issuePage, editorialPage, editorialsPage, feed } from "../lib/templates.mjs";

const NEW_TAB = ' target="_blank" rel="noopener noreferrer"';

test("links that leave tamebuild.ai open in a new tab; our own links do not", () => {
  const html = [
    '<a href="https://www.ftc.gov/news">FTC</a>',
    '<a href="http://example.com/a?b=1&amp;c=2">plain http</a>',
    '<a href="https://www.youtube.com/shorts/x"><img src="https://tamebuild.ai/weekly/assets/x.jpg" alt=""></a>',
    '<a href="https://tamebuild.ai/self-service">ours</a>',
    '<a href="https://www.tamebuild.ai/">ours, www</a>',
    '<a href="https://tamebuild-weekly.netlify.app/weekly/">ours, netlify</a>',
    '<a href="/weekly/2026-10-12/">relative</a>',
    '<a href="#top">anchor</a>',
    '<a href="mailto:jeff@example.com">mail</a>',
    '<a href="https://other.com/" target="_self">already set</a>',
  ].join("\n");
  const out = externalLinksNewTab(html).split("\n");
  assert.equal(out[0], `<a href="https://www.ftc.gov/news"${NEW_TAB}>FTC</a>`);
  assert.ok(out[1].includes(NEW_TAB));
  assert.ok(out[2].startsWith(`<a href="https://www.youtube.com/shorts/x"${NEW_TAB}>`), "a linked image counts");
  for (const line of out.slice(3)) assert.ok(!line.includes('target="_blank"'), line);
});

test("every outside link on every issue and editorial page opens a new tab", () => {
  const issues = loadIssues();
  const pages = [
    ...issues.map((issue, i) => issuePage(issue, { prev: issues[i - 1], next: issues[i + 1] })),
    ...loadEditorials().map(editorialPage),
  ];
  let outside = 0;
  for (const html of pages) {
    const body = html.slice(html.indexOf('class="prose issue-body"'), html.indexOf("</article>"));
    for (const tag of body.match(/<a\s[^>]*>/g) || []) {
      const href = tag.match(/href="([^"]*)"/)[1];
      const ours = !/^https?:\/\//.test(href) || /^https?:\/\/(www\.)?tamebuild\.ai(\/|$)/.test(href);
      if (ours) assert.ok(!tag.includes("target="), tag);
      else {
        outside++;
        assert.ok(tag.includes(NEW_TAB), tag);
      }
    }
  }
  assert.ok(outside > 10, `expected many source links, found ${outside}`);
});

test("the feed keeps plain links", () => {
  assert.ok(!feed({ issues: loadIssues(), editorials: loadEditorials() }).includes('target="_blank"'));
});

test("/weekly/ shows the newest editorial under the latest issue, above the archive", () => {
  const editorials = loadEditorials();
  const newest = [...editorials].sort((a, b) => b.date.localeCompare(a.date))[0];
  const html = indexPage({ issues: loadIssues(), editorials });
  const latestIssue = html.indexOf(">Latest issue<");
  const latestEd = html.indexOf(">Latest editorial<");
  const archive = html.indexOf(">Archive<");
  assert.ok(latestIssue !== -1 && latestEd > latestIssue && archive > latestEd, "order: latest issue, latest editorial, archive");
  const section = html.slice(latestEd, archive);
  assert.ok(section.includes(`href="/weekly${newest.path}"`));
  assert.ok(section.includes('href="/weekly/editorial/"'), "links to all editorials");
  assert.ok(!html.includes(">Editorials<"), "the old bottom list is gone");
});

test("/weekly/editorial/ lists every editorial, newest first", () => {
  const editorials = loadEditorials();
  const html = editorialsPage(editorials);
  const positions = [...editorials]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => html.indexOf(`href="/weekly${e.path}"`));
  assert.ok(positions.every((p) => p !== -1), "all listed");
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "newest first");
});
