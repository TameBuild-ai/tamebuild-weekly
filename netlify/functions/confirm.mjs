// GET  /weekly/api/confirm?t=...  shows a page with a Confirm button
// POST /weekly/api/confirm         confirms the subscription
//
// The link in the email only opens a page. Mail scanners (Microsoft Safe
// Links, Gmail) open links on their own, and a link that confirmed on GET
// would confirm addresses nobody owns.

import { messagePage } from "../../lib/layout.mjs";
import { store, sha256hex, readForm } from "../lib/shared.mjs";

async function lookup(token) {
  if (!token || typeof token !== "string" || token.length > 100) return null;
  const rec = await store("tokens").get(`confirm/${sha256hex(token)}`, { type: "json" });
  if (!rec || Date.parse(rec.expires_at) < Date.now()) return null;
  return rec;
}

const expired = () =>
  messagePage({
    title: "Link expired",
    heading: "This link has expired",
    paragraphs: ['Confirmation links last seven days. <a href="/weekly/">Sign up again</a> and we\'ll send a fresh one.'],
    status: 410,
  });

export default async (req) => {
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("t");
    if (!(await lookup(token))) return expired();
    return messagePage({
      title: "Confirm your subscription",
      heading: "One more step",
      paragraphs: ["Press the button to start getting Tame the Week: one short email each Monday about AI news a small business can act on."],
      form: { action: "/weekly/api/confirm", fields: { t: token }, button: "Confirm my subscription" },
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { t } = await readForm(req);
  const rec = await lookup(t);
  if (!rec) return expired();

  const subs = store("subscribers");
  const sub = await subs.get(`sub/${rec.id}`, { type: "json" });
  if (!sub) return expired();
  const now = new Date().toISOString();
  await subs.setJSON(`sub/${rec.id}`, {
    ...sub,
    status: "confirmed",
    confirmed_at: now,
    updated_at: now,
  });
  await store("tokens").delete(`confirm/${sha256hex(t)}`);

  return messagePage({
    title: "You're subscribed",
    heading: "You're in",
    paragraphs: ["The next issue arrives Monday morning. Every email has an unsubscribe link at the bottom."],
  });
};

export const config = { path: "/weekly/api/confirm" };
