// GET /weekly/api/hold-status?issue=YYYY-MM-DD -> {"issue":..., "held": bool, "held_at": ...}
//
// Read by the engine right before it publishes, and again right before it
// emails subscribers. Public on purpose: it reveals only whether a given
// issue date is on hold, and it needs no credential the engine would have to
// store.

import { store, json, ISSUE_RE } from "../lib/shared.mjs";

export default async (req) => {
  const issue = new URL(req.url).searchParams.get("issue") || "";
  if (!ISSUE_RE.test(issue)) return json({ error: "issue must be YYYY-MM-DD" }, 400);
  const rec = await store("holds").get(issue, { type: "json" });
  return json({ issue, held: Boolean(rec), held_at: rec?.held_at || null });
};

export const config = { path: "/weekly/api/hold-status", method: "GET" };
