import "server-only";

/**
 * Sending what the website's forms collect.
 *
 * The marketing site had no backend at all: the enquiry form flipped to
 * "Enquiry received" on submit and threw the answers away. Somebody filling
 * it in was told their load had reached us when nothing had.
 *
 * The two addresses below are deliberately hardcoded rather than read from
 * the environment. An enquiry is a lead; a lead that goes missing because a
 * variable was not set on a new deploy is the most expensive kind of silent
 * failure this site can have. Change them here, in one place, and they change
 * everywhere.
 */

import nodemailer, { type Transporter } from "nodemailer";

/** Where every website enquiry goes. Both addresses, every time. */
export const ENQUIRY_RECIPIENTS = [
  "operations@wd-logistics.co.zw",
  "admin@wd-logistics.co.zw",
] as const;

// Built on first send rather than at import, so the SMTP host is a runtime
// requirement and not a build-time one — `next build` evaluates this module
// while collecting page data and must not try to dial a mail server.
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return transporter;
}

export interface OutboundMail {
  subject: string;
  text: string;
  html: string;
  /**
   * The enquirer's own address, when they gave one, so a reply in the mail
   * client goes to them rather than back to the website.
   */
  replyTo?: string;
}

/**
 * Sends one message to both business mailboxes.
 *
 * Throws if it could not be sent. The caller shows the person the WhatsApp
 * number instead — the site advertises a reply on WhatsApp anyway, so a mail
 * outage should route them to the faster channel rather than swallow the
 * enquiry and claim success, which is what used to happen.
 */
export async function sendEnquiryMail(mail: OutboundMail): Promise<void> {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP is not configured on this deployment");
  }

  const from =
    process.env.SMTP_FROM_EMAIL
      ? `"${process.env.SMTP_FROM_NAME || "WD Logistics website"}" <${process.env.SMTP_FROM_EMAIL}>`
      : process.env.SMTP_USER;

  await getTransporter().sendMail({
    from,
    // Both named on the To line on purpose: operations act on it, the owner
    // sees it, and either can see the other has it without a forward.
    to: [...ENQUIRY_RECIPIENTS],
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
