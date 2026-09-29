/**
 * Proves the business keeps a copy of every email the system sends.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-email-copies.ts
 *
 * Every email this app sends is addressed to the person it concerns — a
 * customer's invoice, a driver's trip assignment, a user's own password. The
 * office needs to see what went out without those going to the office
 * *instead*, so `sendEmail` blind-copies admin@wd-logistics.co.zw.
 *
 * This walks each of the real senders through a throwaway SMTP server and
 * reads the envelope: the intended recipient is on it, and so is the business
 * mailbox. A sender added later that bypasses `sendEmail` and talks to
 * nodemailer itself would show up here as a missing copy.
 *
 * No real mail is sent.
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
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(40)} ${note}`);
}

const smtp = await startSmtp();

process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(smtp.port);
process.env.SMTP_SECURE = "false";
process.env.SMTP_FROM_EMAIL = "system@wd-logistics.co.zw";
process.env.SMTP_FROM_NAME = "WD Logistics";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;

const email = await import("../../src/lib/email");
const { BUSINESS_MAILBOX, sendEmail } = email;

/** Runs one sender and reports who its message was addressed to. */
async function check(name: string, intended: string, run: () => Promise<unknown>) {
  const before = smtp.sent.length;
  try {
    await run();
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return;
  }

  const produced = smtp.sent.slice(before);
  if (produced.length === 0) {
    record(name, false, "sent nothing");
    return;
  }

  const missingIntended = produced.filter((one) => !one.recipients.includes(intended));
  const missingCopy = produced.filter((one) => !one.recipients.includes(BUSINESS_MAILBOX));

  record(
    name,
    missingIntended.length === 0 && missingCopy.length === 0,
    missingIntended.length > 0
      ? `never reached ${intended}`
      : missingCopy.length > 0
        ? `no copy to ${BUSINESS_MAILBOX}`
        : `${intended} + copy`,
  );
}

try {
  await check("sendEmail, plainly", "someone@example.co.zw", () =>
    sendEmail({
      to: "someone@example.co.zw",
      subject: "Plain send",
      text: "Body",
    }),
  );

  await check("a new user's credentials", "newuser@wd-logistics.co.zw", () =>
    email.sendUserCredentials("newuser@wd-logistics.co.zw", "temp-Password1", "staff"),
  );

  await check("a supervisor's credentials", "supervisor@wd-logistics.co.zw", () =>
    email.sendSupervisorCredentials("supervisor@wd-logistics.co.zw", "temp-Password1"),
  );

  await check("an invoice to a customer", "customer@zimgrain.co.zw", () =>
    email.sendInvoiceEmail({
      customerEmail: "customer@zimgrain.co.zw",
      customerName: "ZimGrain Milling",
      invoiceNumber: "INV-00001",
      issueDate: new Date(),
      dueDate: new Date(),
      subtotal: 1000,
      tax: 145,
      total: 1145,
      items: [{ description: "Haulage Mutare to Beira", quantity: 1, unitPrice: 1000, total: 1000 }],
      organizationName: "WD Logistics",
    } as never),
  );

  await check("a reminder to a customer", "customer@zimgrain.co.zw", () =>
    email.sendInvoiceReminderEmail({
      customerEmail: "customer@zimgrain.co.zw",
      customerName: "ZimGrain Milling",
      invoiceNumber: "INV-00001",
      dueDate: new Date(),
      total: 1145,
      balance: 1145,
      organizationName: "WD Logistics",
    } as never),
  );

  await check("a trip to a driver", "driver@wd-logistics.co.zw", () =>
    email.sendTripAssignmentEmail({
      driverEmail: "driver@wd-logistics.co.zw",
      driverName: "Tendai Moyo",
      origin: "Mutare",
      destination: "Beira",
      scheduledDate: new Date(),
      truckRegistration: "KBZ 123A",
      organizationName: "WD Logistics",
    } as never),
  );

  // Addressed to the office already: it must not arrive twice.
  const before = smtp.sent.length;
  await sendEmail({
    to: BUSINESS_MAILBOX,
    subject: "Straight to the office",
    text: "Body",
  });
  const officeOnly = smtp.sent.slice(before);
  record(
    "a mail already going to the office is not doubled",
    officeOnly.length === 1 && officeOnly[0].recipients.length === 1,
    officeOnly[0]?.recipients.join(", ") ?? "nothing sent",
  );

  // And the one escape hatch works, so the flag is not decoration.
  const beforeOptOut = smtp.sent.length;
  await sendEmail({
    to: "private@example.co.zw",
    subject: "No copy",
    text: "Body",
    copyBusiness: false,
  });
  const optedOut = smtp.sent.slice(beforeOptOut);
  record(
    "a sender can opt out of the copy",
    optedOut.length === 1 && !optedOut[0].recipients.includes(BUSINESS_MAILBOX),
    optedOut[0]?.recipients.join(", ") ?? "nothing sent",
  );
} finally {
  smtp.stop();
}

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0 ? ` Every email is copied to ${BUSINESS_MAILBOX}.` : ""),
);
process.exit(failed === 0 ? 0 : 1);
