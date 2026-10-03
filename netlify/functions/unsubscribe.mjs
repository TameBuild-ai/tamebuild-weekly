// GET  /weekly/api/unsubscribe?e=<id>&s=<sig>  page with an Unsubscribe button
// POST /weekly/api/unsubscribe?e=<id>&s=<sig>  unsubscribes
//
// The engine builds these links (it holds the same WEEKLY_LINK_SECRET) and
// also sends them as a List-Unsubscribe header, so mail apps can unsubscribe
// in one tap: they POST "List-Unsubscribe=One-Click" to the same URL
// (RFC 8058), which this handles with a plain 200.

import { messagePage } from "../../lib/layout.mjs";
import { store, verify, readForm } from "../lib/shared.mjs";

const ID_RE = /^[0-9a-f]{40}$/;

const invalid = () =>
  messagePage({
    title: "Link not recognized",
    heading: "We couldn't read that link",
    paragraphs: [`Reply to any Tame the Week email and ask to be removed, and we'll do it by hand.`],
    status: 400,
  });

export default async (req) => {
  const url = new URL(req.url);
  let e = url.searchParams.get("e");
  let s = url.searchParams.get("s");
  let oneClick = false;

  if (req.method === "POST") {
    const form = await readForm(req);
    e = e || form.e;
    s = s || form.s;
    oneClick = form["List-Unsubscribe"] === "One-Click";
  } else if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!ID_RE.test(e || "") || !verify(`unsub|${e}`, s)) return invalid();

  if (req.method === "GET") {
    return messagePage({
      title: "Unsubscribe",
      heading: "Unsubscribe from Tame the Week?",
      paragraphs: ["Press the button and you won't get any more emails from us."],
      form: { action: `/weekly/api/unsubscribe?e=${e}&s=${encodeURIComponent(s)}`, fields: {}, button: "Unsubscribe" },
    });
  }

  const subs = store("subscribers");
  const sub = (await subs.get(`sub/${e}`, { type: "json" })) || { id: e, email: null };
  const now = new Date().toISOString();
  // Keep the record as a tombstone: the engine reads it on its next sync and
  // must never re-add this address.
  await subs.setJSON(`sub/${e}`, { ...sub, status: "unsubscribed", unsubscribed_at: now, updated_at: now });

  if (oneClick) return new Response("Unsubscribed", { status: 200, headers: { "cache-control": "no-store" } });
  return messagePage({
    title: "Unsubscribed",
    heading: "You're unsubscribed",
    paragraphs: ['You won\'t get any more emails from us. Changed your mind? <a href="/weekly/">Sign up again</a> any time.'],
  });
};

export const config = { path: "/weekly/api/unsubscribe" };
