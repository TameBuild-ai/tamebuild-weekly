// GET  /weekly/hold?issue=YYYY-MM-DD&exp=<unix seconds>&sig=...  page with a Hold button
// POST /weekly/hold                                               records the hold
//
// The engine emails Jeff this link with each draft. The signature covers the
// issue date and the expiry (publish time), so a link works for one issue and
// stops working once that issue would have published. Pressing the button can
// only hold; there is no way to publish or un-hold from this site. To release
// a held issue, Jeff tells Claude, which reruns the publish job by hand.
//
// GET never changes anything, because mail scanners open links on their own.

import { messagePage, esc } from "../../lib/layout.mjs";
import { formatDate } from "../../lib/content.mjs";
import { store, verify, readForm, ISSUE_RE } from "../lib/shared.mjs";

function check(issue, exp, sig) {
  if (!ISSUE_RE.test(issue || "") || !/^\d{9,11}$/.test(exp || "")) return "invalid";
  if (!verify(`hold|${issue}|${exp}`, sig)) return "invalid";
  if (Number(exp) * 1000 < Date.now()) return "expired";
  return "ok";
}

function when(exp) {
  return new Date(Number(exp) * 1000).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async (req) => {
  let issue, exp, sig;
  if (req.method === "GET") {
    const p = new URL(req.url).searchParams;
    [issue, exp, sig] = [p.get("issue"), p.get("exp"), p.get("sig")];
  } else if (req.method === "POST") {
    ({ issue, exp, sig } = await readForm(req));
  } else {
    return new Response("Method not allowed", { status: 405 });
  }

  const state = check(issue, exp, sig);
  if (state === "invalid") {
    return messagePage({ title: "Link not recognized", heading: "This hold link isn't valid", paragraphs: ["Use the link from the most recent draft email."], status: 400 });
  }
  if (state === "expired") {
    return messagePage({
      title: "Too late to hold",
      heading: "This issue has already gone out",
      paragraphs: [`The hold link for the ${esc(formatDate(issue))} issue stopped working at publish time.`],
      status: 410,
    });
  }

  const holds = store("holds");
  const existing = await holds.get(issue, { type: "json" });

  if (req.method === "GET") {
    if (existing) {
      return messagePage({ title: "Already held", heading: "This issue is on hold", paragraphs: [`The ${esc(formatDate(issue))} issue will not publish.`] });
    }
    return messagePage({
      title: "Hold this issue",
      heading: `Hold the ${formatDate(issue)} issue?`,
      paragraphs: [`It publishes ${esc(when(exp))} unless you hold it. Holding stops the page and the subscriber email for this one issue.`],
      form: { action: "/weekly/hold", fields: { issue, exp, sig }, button: "Hold this issue" },
    });
  }

  if (!existing) await holds.setJSON(issue, { held_at: new Date().toISOString(), exp: Number(exp) });
  return messagePage({
    title: "Held",
    heading: "Held",
    paragraphs: [`The ${esc(formatDate(issue))} issue will not publish. You'll get a note from the engine confirming it skipped the issue.`],
  });
};

export const config = { path: "/weekly/hold" };
