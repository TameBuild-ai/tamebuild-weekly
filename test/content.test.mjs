import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontMatter } from "../lib/frontmatter.mjs";
import { parseIssueBody, assertNoEmDash, loadIssues, loadEditorials } from "../lib/content.mjs";

test("front matter: strings, quotes, booleans", () => {
  const { data, body } = parseFrontMatter('---\ntitle: "A: B"\nemail: false\nauthor: Jeff\n---\nHello\n');
  assert.deepEqual(data, { title: "A: B", email: false, author: "Jeff" });
  assert.equal(body, "Hello\n");
});

test("front matter: a line without a colon fails", () => {
  assert.throws(() => parseFrontMatter("---\njust words\n---\nx"), /not "key: value"/);
});

test("issue body: title line removed, items become h2, intro found", () => {
  const p = parseIssueBody("**Tame the Week: May 4, 2026**\n\nOne sentence.\n\n**1. First thing**\n\nBody.\n\n**2. Second**\n\nMore.\n", "t");
  assert.equal(p.title, "Tame the Week: May 4, 2026");
  assert.deepEqual(p.headlines, ["First thing", "Second"]);
  assert.equal(p.intro, "One sentence.");
  assert.match(p.markdown, /^## 1\. First thing$/m);
});

test("em dash anywhere fails with a line number", () => {
  assert.throws(() => assertNoEmDash("ok\nbad — here", "x"), /line 2/);
  assert.doesNotThrow(() => assertNoEmDash("hyphen - and en dash – are fine", "x"));
});

test("Issue 1 loads with its lead headline and window", () => {
  const [one] = loadIssues();
  assert.equal(one.date, "2026-10-03");
  assert.equal(one.number, 1);
  assert.equal(one.headline, "A cloned voice talked a bank chairman out of €95 million");
  assert.equal(one.windowStart, "2026-09-27");
  assert.equal(one.windowEnd, "2026-10-03");
  assert.equal(one.headlines.length, 3);
});

test("editorials folder README is not treated as an editorial", () => {
  assert.deepEqual(loadEditorials(), []);
});
