// GET  /weekly/api/confirm?t=...  confirm page
// POST /weekly/api/confirm         confirms the subscription
//
// For a person, one click: the page submits the confirmation itself with a
// script as soon as it loads, then says "You're subscribed." The button stays
// as the fallback when scripts don't run. The GET request itself never
// changes anything, so a mail scanner that only fetches the link does not
// confirm an address.

import { messagePage } from "../../lib/layout.mjs";
import { store, sha256hex, readForm, json } from "../lib/shared.mjs";

const SUBSCRIBED_HEADING = "You're subscribed.";
const SUBSCRIBED_TEXT = "The next issue arrives Monday morning. Every email has an unsubscribe link at the bottom.";

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

// Runs on page load. Posts the same form the button would, asking for JSON,
// and swaps the page to the subscribed message. Any failure leaves the
// button in place.
const AUTO_SUBMIT = `(function () {
  var form = document.querySelector(".msg-form");
  if (!form || !window.fetch) return;
  var heading = document.getElementById("msg-heading");
  var body = document.getElementById("msg-body");
  heading.textContent = "Confirming your subscription";
  form.style.visibility = "hidden";
  fetch(form.action, { method: "POST", headers: { accept: "application/json" }, body: new URLSearchParams(new FormData(form)) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
    .then(function (res) {
      if (res.ok) {
        heading.textContent = ${JSON.stringify(SUBSCRIBED_HEADING)};
        body.innerHTML = '<p class="lede">' + ${JSON.stringify(SUBSCRIBED_TEXT)} + "</p>";
      } else if (res.j && res.j.expired) {
        heading.textContent = "This link has expired";
        body.innerHTML = '<p class="lede">Confirmation links last seven days. <a href="/weekly/">Sign up again</a> and we\\'ll send a fresh one.</p>';
      } else {
        throw new Error("not confirmed");
      }
    })
    .catch(function () {
      heading.textContent = "One more step";
      form.style.visibility = "visible";
    });
})();`;

export default async (req) => {
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("t");
    if (!(await lookup(token))) return expired();
    return messagePage({
      title: "Confirm your subscription",
      heading: "One more step",
      paragraphs: ["Press the button to start getting Tame the Week: one short email each Monday about AI news a small business can act on."],
      form: { action: "/weekly/api/confirm", fields: { t: token }, button: "Confirm my subscription" },
      script: AUTO_SUBMIT,
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const wantsJson = (req.headers.get("accept") || "").includes("application/json");
  const { t } = await readForm(req);
  const rec = await lookup(t);
  if (!rec) return wantsJson ? json({ ok: false, expired: true }, 410) : expired();

  const subs = store("subscribers");
  const sub = await subs.get(`sub/${rec.id}`, { type: "json" });
  if (!sub) return wantsJson ? json({ ok: false, expired: true }, 410) : expired();
  const now = new Date().toISOString();
  await subs.setJSON(`sub/${rec.id}`, { ...sub, status: "confirmed", confirmed_at: now, updated_at: now });
  await store("tokens").delete(`confirm/${sha256hex(t)}`);

  if (wantsJson) return json({ ok: true });
  return messagePage({ title: "You're subscribed", heading: SUBSCRIBED_HEADING, paragraphs: [SUBSCRIBED_TEXT] });
};

export const config = { path: "/weekly/api/confirm" };
