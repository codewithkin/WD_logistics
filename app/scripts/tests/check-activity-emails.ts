/**
 * Proves the office is emailed when something happens in the system.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-activity-emails.ts
 *
 * Email was deliberately absent from every notification tier — the note at the
 * top of lib/notification-tiers.ts says so — which meant an admin learned about
 * a new record only from the in-app bell or a push, and never by email. The
 * owner asked for the email, so tiers 1 to 3 now send one to the hardcoded
 * business mailbox.
 *
 * The line between "told" and "spammed" is the thing worth testing, so this
 * checks both directions: a creation is emailed, a routine edit is not, and an
 * event nobody is subscribed to still reaches the office because it still
 * happened.
 *
 * A throwaway SMTP server stands in for the mail host. No real mail is sent.
 * It writes notification rows and removes them again.
 */

import net from "node:net";

interface Envelope {
  recipients: string[];
  body: string;
}

function startSmtp(): Promise<{ port: number; sent: Envelope[]; stop: () => void }> {
  const sent: Envelope[] = [];

  const server = net.createServer((socket) => {
    let current: Envelope = { recipients: [], body: "" };
    let readingData = false;
    let buffer = "";

    socket.write("220 localhost ESMTP test\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (readingData) {
          if (line === ".") {
            readingData = false;
            sent.push(current);
            current = { recipients: [], body: "" };
            socket.write("250 OK queued\r\n");
          } else {
            current.body += `${line}\n`;
          }
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 8BITMIME\r\n");
        } else if (upper.startsWith("RCPT TO")) {
          current.recipients.push(
            line.slice(line.indexOf(":") + 1).trim().replace(/^<|>$/g, ""),
          );
          socket.write("250 OK\r\n");
        } else if (upper === "DATA") {
          readingData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });

    socket.on("error", () => {
      /* a client hanging up mid-conversation is not this test's business */
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ port, sent, stop: () => server.close() });
    });
  });
}

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(46)} ${note}`);
}

const smtp = await startSmtp();

process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(smtp.port);
process.env.SMTP_SECURE = "false";
process.env.SMTP_FROM_EMAIL = "system@wd-logistics.co.zw";
process.env.SMTP_FROM_NAME = "WD Logistics";
process.env.BETTER_AUTH_URL = "https://cloud.wd-logistics.co.zw";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;

const { prisma } = await import("../../src/lib/prisma");
const { notifyByTierKey } = await import("../../src/lib/notifications");
const { BUSINESS_MAILBOX } = await import("../../src/lib/email");
const { emailsTheOffice, getTierConfig } = await import("../../src/lib/notification-tiers");

const found = await prisma.organization.findFirst({ select: { id: true } });
if (!found) throw new Error("no organisation — run db:seed first");
const organization = found;

const MARKER = "ACTIVITY-EMAIL-CHECK";

/** Fires one event and reports what reached the mail server. */
async function fire(key: string, title: string) {
  const before = smtp.sent.length;
  await notifyByTierKey({
    key,
    organizationId: organization.id,
    title: `${title} ${MARKER}`,
    message: `${MARKER}: raised by the activity-email check.`,
    link: "/edit-requests",
    entityType: "edit_request",
  });
  return smtp.sent.slice(before);
}

try {
  // A creation — tier 3, the case the owner asked about by name.
  const created = await fire("truck_created", "A truck was added");
  const toOffice = created.filter((mail) => mail.recipients.includes(BUSINESS_MAILBOX));
  record(
    "a new record emails the office",
    toOffice.length === 1,
    `${created.length} mail(s), ${toOffice.length} to ${BUSINESS_MAILBOX}`,
  );

  if (toOffice[0]) {
    const body = toOffice[0].body.replace(/=\r?\n/g, "");
    record("it carries the event's own wording", body.includes(MARKER), "");
    record(
      "it links back into the system",
      body.includes("cloud.wd-logistics.co.zw/edit-requests"),
      "",
    );
    record(
      "the office is not also blind-copied",
      toOffice[0].recipients.length === 1,
      toOffice[0].recipients.join(", "),
    );
  }

  // Something critical — tier 1.
  const critical = await fire("document_expired", "A document has expired");
  record(
    "a critical event emails the office",
    critical.some((mail) => mail.recipients.includes(BUSINESS_MAILBOX)),
    `${critical.length} mail(s)`,
  );

  // A routine edit — tier 4, in-app only. This is the line that keeps the
  // mailbox readable.
  const edited = await fire("truck_updated", "A truck was edited");
  record(
    "a routine edit does not email",
    !edited.some((mail) => mail.recipients.includes(BUSINESS_MAILBOX)),
    `tier ${getTierConfig("truck_updated").tier}, ${edited.length} mail(s)`,
  );

  record(
    "the tier line is where it says it is",
    emailsTheOffice("truck_created") &&
      emailsTheOffice("document_expired") &&
      !emailsTheOffice("truck_updated"),
    "tiers 1-3 yes, 4-5 no",
  );

  // An event whose tier targets a role nobody holds still has to reach the
  // office, because it still happened.
  const workshopOnly = await fire("maintenance_daily_digest", "Workshop digest");
  record(
    "an event with no subscriber still reaches the office",
    workshopOnly.some((mail) => mail.recipients.includes(BUSINESS_MAILBOX)),
    `${workshopOnly.length} mail(s)`,
  );

  // A mail failure must not take the caller down with it.
  smtp.stop();
  let threw = false;
  try {
    await notifyByTierKey({
      key: "truck_created",
      organizationId: organization.id,
      title: `Mail is down ${MARKER}`,
      message: `${MARKER}: raised while the mail server is stopped.`,
    });
  } catch {
    threw = true;
  }
  record("a mail outage does not break the caller", !threw, "notifyByTierKey returned");
} finally {
  smtp.stop();
  const removed = await prisma.userNotification.deleteMany({
    where: { message: { contains: MARKER } },
  });
  console.log(`\ncleaned up: ${removed.count} notification row(s)`);
}

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0 ? ` System activity reaches ${BUSINESS_MAILBOX}.` : ""),
);
process.exit(failed === 0 ? 0 : 1);
