import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Since 2026-10-10 the engine signs hold links to expire at the 6 PM Central
// late limit, not at a fixed 10 AM publish time, and a hold pressed after the
// page is live stops the subscriber email. The page must say so, and must not
// promise a publish time the link no longer carries.
const src = fs.readFileSync(new URL("../netlify/functions/hold.mjs", import.meta.url), "utf8");

test("the hold page describes what holding stops, including after the page is live", () => {
  assert.match(src, /If the page is already live, holding still stops the email/);
  assert.match(src, /If its page was already live, the subscriber email will not go out/);
  assert.match(src, /6 PM Central limit/);
});

test("the hold page no longer claims the link's expiry is the publish time", () => {
  assert.doesNotMatch(src, /It publishes \$\{esc\(when\(exp\)\)\}/);
  assert.doesNotMatch(src, /stopped working at publish time/);
});

test("no em dash in the hold page copy", () => {
  assert.doesNotMatch(src, /—/);
});
