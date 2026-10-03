// POST /weekly/api/subscribe
//
// Double opt-in: this only records a pending signup and emails a confirmation
// link. Nobody is added to the list until they press the button on the
// confirmation page (confirm.mjs).
//
// Every outcome except a rate limit shows the same "check your email" page,
// so the form cannot be used to learn whether an address is subscribed.

import crypto from "node:crypto";
import { messagePage, esc } from "../../lib/layout.mjs";
import { linkUrl } from "../../lib/config.mjs";
import { EMAIL_RE, store, emailId, sha256hex, clientIp, overLimit, readForm, sendEmail } from "../lib/shared.mjs";

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;
const RESEND_GAP_MS = 10 * 60 * 1000;

function checkEmail(email) {
  return messagePage({
    title: "Check your email",
    heading: "Check your email",
    paragraphs: [
      `If <strong>${esc(email)}</strong> can receive mail, a confirmation link is on its way. Press the button in that email to start getting Tame the Week.`,
      "Nothing there after a few minutes? Check your spam or promotions folder.",
    ],
  });
}

function confirmEmail(link) {
  const text = `Confirm your subscription to Tame the Week

Press this link and then the button on the page to start getting one short email a week about AI news you can act on:

${link}

If you didn't ask for this, ignore this email and you won't hear from us again.`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F1EADA;font-family:Arial,Helvetica,sans-serif;color:#14110D;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px;border:1px solid #d8cfba;">
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a6d12;margin:0 0 12px;">Tame the Week</p>
<h1 style="font-size:22px;margin:0 0 14px;">Confirm your subscription</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">Press the button, then confirm on the page that opens, to start getting one short email a week about AI news you can act on.</p>
<p style="margin:0 0 24px;"><a href="${esc(link)}" style="display:inline-block;background:#C9A227;color:#14110D;padding:12px 22px;text-decoration:none;font-weight:bold;">Confirm my subscription</a></p>
<p style="font-size:13px;line-height:1.5;color:#555;margin:0;">If you didn't ask for this, ignore this email and you won't hear from us again.</p>
</div></body></html>`;
  return { text, html };
}

export default async (req, context) => {
  if (req.method !== "POST") return Response.redirect(new URL("/weekly/#top-label", req.url), 303);

  const form = await readForm(req);
  const email = String(form.email || "").trim().toLowerCase();

  // Honeypot: real people never see this field. Pretend it worked.
  if (form.website) return checkEmail(email || "your address");

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return messagePage({
      title: "Check the address",
      heading: "That address doesn't look right",
      paragraphs: ["Go back and check the spelling, then try again."],
      status: 400,
    });
  }

  const ip = clientIp(req, context);
  const limited =
    (await overLimit(`ip:${sha256hex(ip).slice(0, 24)}`, 5, 3600)) ||
    (await overLimit(`email:${emailId(email)}`, 3, 86400)) ||
    (await overLimit("global", 120, 3600));
  if (limited) {
    return messagePage({
      title: "Too many tries",
      heading: "Too many tries",
      paragraphs: ["Please wait an hour and try again."],
      status: 429,
    });
  }

  const subs = store("subscribers");
  const id = emailId(email);
  const existing = await subs.get(`sub/${id}`, { type: "json" });
  const now = Date.now();

  if (existing?.status === "confirmed") return checkEmail(email);
  if (existing?.status === "pending" && existing.last_sent_at && now - Date.parse(existing.last_sent_at) < RESEND_GAP_MS) {
    return checkEmail(email);
  }

  const token = crypto.randomBytes(24).toString("base64url");
  await store("tokens").setJSON(`confirm/${sha256hex(token)}`, { id, expires_at: new Date(now + TOKEN_TTL_MS).toISOString() });
  await subs.setJSON(`sub/${id}`, {
    ...(existing || {}),
    id,
    email,
    status: "pending",
    created_at: existing?.created_at || new Date(now).toISOString(),
    last_sent_at: new Date(now).toISOString(),
  });

  const link = linkUrl(`/api/confirm?t=${token}`);
  try {
    await sendEmail({ to: email, subject: "Confirm your subscription to Tame the Week", ...confirmEmail(link), idempotencyKey: `confirm-${sha256hex(token).slice(0, 32)}` });
  } catch (err) {
    console.error("subscribe: confirmation email failed", err.code || "", err.message);
    return messagePage({
      title: "Something went wrong",
      heading: "We couldn't send the confirmation",
      paragraphs: ["Please try again in a little while."],
      status: 503,
    });
  }
  return checkEmail(email);
};

export const config = { path: "/weekly/api/subscribe" };
