import test from "node:test";
import assert from "node:assert/strict";

process.env.WEEKLY_LINK_SECRET = "test-secret-that-is-long-enough-0123456789";
const { sign, verify, emailId } = await import("../netlify/lib/shared.mjs");

test("hold signatures bind the issue and expiry", () => {
  const sig = sign("hold|2026-10-12|1791817200");
  assert.ok(verify("hold|2026-10-12|1791817200", sig));
  assert.ok(!verify("hold|2026-10-19|1791817200", sig), "another issue");
  assert.ok(!verify("hold|2026-10-12|1891817200", sig), "a later expiry");
  assert.ok(!verify("unsub|2026-10-12|1791817200", sig), "another purpose");
  assert.ok(!verify("hold|2026-10-12|1791817200", ""), "empty");
});

test("emailId ignores case and surrounding space", () => {
  assert.equal(emailId(" Jeff@Example.com "), emailId("jeff@example.com"));
  assert.match(emailId("a@b.co"), /^[0-9a-f]{40}$/);
});
