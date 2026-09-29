"use server";

/**
 * The website's enquiry form, server side.
 *
 * Everything the form collects is optional except a name and a way to reach
 * them — the form itself says "skip what you don't know" about the load, and
 * a lead with a phone number and nothing else is still a lead worth having.
 *
 * What this deliberately does not do is store anything. The site has no
 * database of its own and should not grow one to hold leads; the enquiry goes
 * to the two mailboxes and lives in the inbox, which is where whoever answers
 * it is already looking.
 */

import { ENQUIRY_RECIPIENTS, sendEnquiryMail } from "@/lib/mail";

export interface EnquiryResult {
  ok: boolean;
  /** Shown to the person. Written for them, not for a log. */
  error?: string;
  /** Which field to point at, when one is at fault. */
  field?: string;
}

/** Fields in the order they are asked, with the labels the email uses. */
const LOAD_FIELDS: Array<[key: string, label: string]> = [
  ["unitLoad", "Unit load"],
  ["units", "Number of units"],
  ["origin", "Start location"],
  ["destination", "Destination"],
  ["distance", "Estimated distance"],
  ["departure", "Departure date"],
];

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Trimmed, and capped so a paste of a whole spreadsheet cannot fill a mailbox. */
function read(form: FormData, key: string, max = 300): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function submitEnquiry(form: FormData): Promise<EnquiryResult> {
  // A field no person can see, so anything that fills it in is a bot. Cheaper
  // and less hostile than a captcha on a form this size, and it fails quietly
  // so the bot is not told why.
  if (read(form, "website")) {
    return { ok: true };
  }

  const name = read(form, "name", 120);
  const phone = read(form, "phone", 40);
  const email = read(form, "email", 160);
  const company = read(form, "company", 160);
  const notes = read(form, "notes", 2000);

  if (name.length < 2) {
    return { ok: false, error: "Please give us a name to put to the enquiry.", field: "name" };
  }
  if (phone.replace(/\D/g, "").length < 9) {
    return {
      ok: false,
      error: "We reply on WhatsApp, so we need a number we can reach you on.",
      field: "phone",
    };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That email address does not look right.", field: "email" };
  }

  const load = LOAD_FIELDS.map(([key, label]) => [label, read(form, key)] as const).filter(
    ([, value]) => value.length > 0,
  );

  const who = [
    ["Name", name],
    ["WhatsApp", phone],
    ["Email", email],
    ["Company", company],
  ].filter(([, value]) => value.length > 0) as Array<[string, string]>;

  const subject = company
    ? `Website enquiry — ${name}, ${company}`
    : `Website enquiry — ${name}`;

  const lines = [
    "An enquiry came in through the website.",
    "",
    ...who.map(([label, value]) => `${label}: ${value}`),
  ];

  if (load.length > 0) {
    lines.push("", "About the load", ...load.map(([label, value]) => `${label}: ${value}`));
  }
  if (notes) {
    lines.push("", "They also said", notes);
  }
  lines.push(
    "",
    email
      ? `Reply to this email to answer them directly, or message ${phone} on WhatsApp.`
      : `Message ${phone} on WhatsApp to answer them — they left no email address.`,
  );

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:6px 16px 6px 0;color:#646B65;font:14px/1.5 Arial,sans-serif;white-space:nowrap;vertical-align:top">${escape(label)}</td>
      <td style="padding:6px 0;color:#1E2320;font:600 14px/1.5 Arial,sans-serif">${escape(value)}</td>
    </tr>`;

  const html = `<div style="background:#EDEFEC;padding:24px">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #E6E9E2;border-radius:16px;padding:28px">
    <p style="margin:0 0 4px;color:#3D8A14;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase">Website enquiry</p>
    <h1 style="margin:0 0 20px;color:#1E2320;font:600 22px/1.3 Arial,sans-serif">${escape(name)}${
      company ? ` &middot; ${escape(company)}` : ""
    }</h1>

    <table style="border-collapse:collapse;width:100%">${who.map(([l, v]) => row(l, v)).join("")}</table>

    ${
      load.length > 0
        ? `<h2 style="margin:24px 0 8px;color:#1E2320;font:600 15px/1.3 Arial,sans-serif">About the load</h2>
           <table style="border-collapse:collapse;width:100%">${load
             .map(([l, v]) => row(l, v))
             .join("")}</table>`
        : `<p style="margin:24px 0 0;color:#787F79;font:14px/1.6 Arial,sans-serif">They gave no details about the load.</p>`
    }

    ${
      notes
        ? `<h2 style="margin:24px 0 8px;color:#1E2320;font:600 15px/1.3 Arial,sans-serif">They also said</h2>
           <p style="margin:0;color:#333833;font:14px/1.7 Arial,sans-serif;white-space:pre-wrap">${escape(notes)}</p>`
        : ""
    }

    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #ECEEE9;color:#787F79;font:13px/1.6 Arial,sans-serif">
      ${
        email
          ? `Reply to this email to answer them directly, or message <strong>${escape(phone)}</strong> on WhatsApp.`
          : `Message <strong>${escape(phone)}</strong> on WhatsApp to answer them — they left no email address.`
      }
    </p>
  </div>
</div>`;

  try {
    await sendEnquiryMail({
      subject,
      text: lines.join("\n"),
      html,
      replyTo: email || undefined,
    });
    return { ok: true };
  } catch (error) {
    // The enquiry is not lost as far as the person is concerned — they are
    // sent to WhatsApp, which the page already tells them is the fast route —
    // but it is lost to us, so it is logged loudly.
    console.error(
      `Website enquiry from ${name} (${phone}) could not be mailed to ${ENQUIRY_RECIPIENTS.join(" and ")}:`,
      error,
    );
    return {
      ok: false,
      error:
        "Something went wrong sending that. Please message us on WhatsApp instead — the number is at the top of this page.",
    };
  }
}
