// GET /weekly/api/subscribers   (Authorization: Bearer <SUBSCRIBER_SYNC_TOKEN>)
//
// The engine reads the list from here before each send. This site stores only
// the SHA-256 of the engine's token, so the token cannot be recovered from the
// site's settings.

import crypto from "node:crypto";
import { store, json, sha256hex } from "../lib/shared.mjs";

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
  const { blobs } = await subs.list({ prefix: "sub/" });
  const records = await Promise.all(blobs.map((b) => subs.get(b.key, { type: "json" })));
  const subscribers = records.filter(Boolean).map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    confirmed_at: r.confirmed_at || null,
    unsubscribed_at: r.unsubscribed_at || null,
  }));
  return json({ count: subscribers.length, subscribers });
};

export const config = { path: "/weekly/api/subscribers", method: "GET" };
