// Shared pieces for the weekly site's functions.
//
// What this site holds, and what a leak of it could do:
//   WEEKLY_LINK_SECRET            signs hold and unsubscribe links. A leak lets
//                                 someone hold an issue or unsubscribe a reader.
//                                 It cannot publish anything.
//   SUBSCRIBER_SYNC_TOKEN_SHA256  only the hash of the engine's token, so a leak
//                                 of this site's settings does not expose it.
//   RESEND_SENDING_KEY            a Resend key limited to sending from
//                                 news.tamebuild.ai. It cannot read the
//                                 subscriber list, send broadcasts, or touch
//                                 the tamebuild.ai domain the main site uses.
// No GitHub or Netlify credential lives here, so nothing on this site can
// change the engine, publish an issue, or reach another site.

import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getConfig } from "../../lib/config.mjs";

export const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
export const ISSUE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function store(name) {
  return getStore({ name, consistency: "strong" });
}

export function sha256hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// The stable, non-reversible id for a subscriber. The engine computes the same
// value, so unsubscribe links carry this rather than the address itself.
export function emailId(email) {
  return sha256hex(String(email).trim().toLowerCase()).slice(0, 40);
}

function linkSecret() {
  const s = process.env.WEEKLY_LINK_SECRET;
  if (!s || s.length < 32) throw new Error("WEEKLY_LINK_SECRET is not set");
  return s;
}

export function sign(message) {
  return crypto.createHmac("sha256", linkSecret()).update(message).digest("base64url");
}

export function verify(message, sig) {
  if (typeof sig !== "string" || !sig) return false;
  const expected = Buffer.from(sign(message));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function clientIp(req, context) {
  // Behind the tamebuild.ai proxy the connecting address is Netlify's, so
  // prefer the first X-Forwarded-For hop when present.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
}

// Fixed-window counter in Blobs. Not atomic, which is fine for its job: making
// a script that hammers the form give up, not exact accounting.
export async function overLimit(key, limit, windowSeconds) {
  const s = store("ratelimit");
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const k = `${key}:${bucket}`;
  const n = Number((await s.get(k)) || 0) + 1;
  await s.set(k, String(n));
  return n > limit;
}

export async function readForm(req) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const fd = await req.formData();
    return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  }
  if (type.includes("application/json")) return await req.json().catch(() => ({}));
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const key = process.env.RESEND_SENDING_KEY;
  if (!key) throw Object.assign(new Error("RESEND_SENDING_KEY is not set"), { code: "not_configured" });
  const c = getConfig();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: `${c.fromName} <${c.fromAddress}>`,
      to: [to],
      reply_to: c.replyTo,
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw Object.assign(new Error(`Resend ${res.status}: ${body}`), { code: "send_failed" });
  }
  return res.json();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
