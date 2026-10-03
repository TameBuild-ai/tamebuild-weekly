// Hand-off of confirmed signups to the engine, which moves them into Resend.
//
//   GET    /weekly/api/subscribers           confirmed signups waiting to move
//   DELETE /weekly/api/subscribers?id=<id>   forget one once it is in Resend
//
// Both need Authorization: Bearer <SUBSCRIBER_SYNC_TOKEN>. This site stores
// only the token's SHA-256, so the token cannot be recovered from the site's
// settings. The list itself lives in Resend; this store only holds signups
// between confirmation and the engine's next run, so it never accumulates a
// copy of the subscriber list.

import crypto from "node:crypto";
import { store, json, sha256hex } from "../lib/shared.mjs";

const ID_RE = /^[0-9a-f]{40}$/;

function authorized(req) {
  const expected = process.env.SUBSCRIBER_SYNC_TOKEN_SHA256 || "";
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !token) return false;
  const a = Buffer.from(sha256hex(token));
  const b = Buffer.from(expected.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const subs = store("subscribers");

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
    await subs.delete(`sub/${id}`);
    return json({ deleted: id });
  }
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const { blobs } = await subs.list({ prefix: "sub/" });
  const records = await Promise.all(blobs.map((b) => subs.get(b.key, { type: "json" })));
  const subscribers = records
    .filter((r) => r && r.status === "confirmed" && r.email)
    .map((r) => ({ id: r.id, email: r.email, status: r.status, confirmed_at: r.confirmed_at || null }));
  return json({ count: subscribers.length, subscribers });
};

export const config = { path: "/weekly/api/subscribers" };
