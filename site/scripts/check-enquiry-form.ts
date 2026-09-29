/**
 * Proves the enquiry form sends, and sends to both business mailboxes.
 *
 *   bun scripts/check-enquiry-form.ts
 *
 * The form used to be decoration — no field had a name, nothing was read on
 * submit, and it flipped straight to "Enquiry received". So this does not test
 * that a button changes state; it stands up a throwaway SMTP server, submits
 * the form through the real server action, and reads what actually arrived:
 * the recipients, the reply-to, and whether the answers are in the body.
 *
 * No real mail is sent and nothing outside this process is touched.
 */

import net from "node:net";

interface Captured {
  recipients: string[];
  from: string;
  body: string;
}

/**
 * Enough of SMTP to accept one message.
 *
 * Deliberately does not advertise AUTH, so nodemailer skips it — this is a
 * stand-in for a mail server, not a mail server.
 */
function startSmtp(): Promise<{ port: number; messages: Captured[]; stop: () => void }> {
  const messages: Captured[] = [];

  const server = net.createServer((socket) => {
    let current: Captured = { recipients: [], from: "", body: "" };
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
            messages.push(current);
            current = { recipients: [], from: "", body: "" };
            socket.write("250 OK queued\r\n");
          } else {
            current.body += `${line}\n`;
          }
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 8BITMIME\r\n");
        } else if (upper.startsWith("MAIL FROM")) {
          current.from = line.slice(line.indexOf(":") + 1).trim();
          socket.write("250 OK\r\n");
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
      resolve({ port, messages, stop: () => server.close() });
    });
  });
}

/**
 * Undoes the two encodings a message picks up on the wire.
 *
 * Headers and body have to be treated separately, and getting that wrong is
 * subtle: a quoted-printable soft break is "=" before a newline, and an RFC
 * 2047 encoded word *ends* with "?=" — so stripping soft breaks across the
 * whole message eats the "=" that terminates a folded encoded word and the
 * header stops decoding. Headers are unfolded and then decoded; the body has
 * its soft breaks removed.
 */
function decode(raw: string): string {
  const split = raw.search(/\r?\n\r?\n/);
  const headerPart = split === -1 ? raw : raw.slice(0, split);
  const bodyPart = split === -1 ? "" : raw.slice(split);

  const unfolded = headerPart.replace(/\r?\n[ \t]+/g, "");
  const headers = unfolded.replace(
    /=\?UTF-8\?Q\?([^?]*)\?=/gi,
    (_match, encoded: string) =>
      encoded
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_hex, code: string) =>
          String.fromCharCode(Number.parseInt(code, 16)),
        ),
  );

  const body = bodyPart.replace(/=\r?\n/g, "").replace(/=3D/gi, "=");

  return `${headers}${body}`;
}

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(42)} ${note}`);
}

const smtp = await startSmtp();

process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(smtp.port);
process.env.SMTP_SECURE = "false";
process.env.SMTP_FROM_EMAIL = "website@wd-logistics.co.zw";
process.env.SMTP_FROM_NAME = "WD Logistics website";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;

// Imported after the environment is set, because the transport is built on
// first use and reads these then.
const { submitEnquiry, submitEnquiryAction } = await import(
  "../src/app/actions/enquiry"
);
const { ENQUIRY_RECIPIENTS } = await import("../src/lib/mail");

function formOf(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

try {
  // ---------------------------------------------------------- the happy path
  const full = await submitEnquiry(
    formOf({
      name: "Tarisai Moyo",
      phone: "+263 77 450 8908",
      email: "tarisai@zimgrain.co.zw",
      company: "ZimGrain Milling",
      unitLoad: "30t maize in bags",
      units: "2 trailer loads",
      origin: "Nyakamete, Mutare",
      destination: "Beitbridge",
      distance: "275 km",
      departure: "2026-10-12",
      notes: "Gate is narrow — a superlink will not turn inside the yard.",
    }),
  );
  record("a complete enquiry is accepted", full.ok, full.error ?? "");

  const sent = smtp.messages[0];
  if (!sent) {
    record("the mail reached a server", false, "nothing arrived");
  } else {
    record("the mail reached a server", true, `${sent.body.length} bytes`);

    const expected = [...ENQUIRY_RECIPIENTS];
    const missing = expected.filter((address) => !sent.recipients.includes(address));
    record(
      "both business mailboxes are on it",
      missing.length === 0 && sent.recipients.length === expected.length,
      missing.length === 0
        ? sent.recipients.join(", ")
        : `missing ${missing.join(", ")}`,
    );

    record(
      "operations@ is one of them",
      sent.recipients.includes("operations@wd-logistics.co.zw"),
      "",
    );
    record(
      "admin@ is one of them",
      sent.recipients.includes("admin@wd-logistics.co.zw"),
      "",
    );

    // The body is quoted-printable, so long values can be soft-wrapped with a
    // trailing "=", and headers carrying a non-ASCII character (the em dash in
    // the subject) arrive as RFC 2047 encoded words. Both are undone before
    // asserting, rather than matching the encoded form, which would pass for
    // the wrong reasons.
    const body = decode(sent.body);

    for (const [what, needle] of [
      ["the name", "Tarisai Moyo"],
      ["the number", "450 8908"],
      ["the company", "ZimGrain Milling"],
      ["the load", "30t maize in bags"],
      ["the route", "Beitbridge"],
      ["what they added", "superlink will not turn"],
    ] as const) {
      record(`${what} is in the email`, body.includes(needle), "");
    }

    record(
      "a reply goes to the enquirer",
      /reply-to:\s*tarisai@zimgrain\.co\.zw/i.test(body),
      "",
    );
    record("the subject names them", /subject:.*Tarisai Moyo/i.test(body), "");
  }

  // -------------------------------------------- arriving from a service card
  const fromCard = await submitEnquiry(
    formOf({
      name: "Chiedza Nyoni",
      phone: "0772958986",
      service: "abnormal",
    }),
  );
  record("a service card's enquiry is accepted", fromCard.ok, fromCard.error ?? "");
  const carded = smtp.messages[1];
  if (carded) {
    const body = decode(carded.body);
    record(
      "the service is named in the subject",
      /subject:.*Abnormal & project loads/i.test(body),
      "",
    );
    record("and in the body", body.includes("Asking about: Abnormal"), "");
  }

  // A slug that is not one of ours is dropped rather than printed into an
  // email that somebody in operations is going to open.
  const junk = await submitEnquiry(
    formOf({
      name: "Probe",
      phone: "0772958986",
      service: "<script>alert(1)</script>",
    }),
  );
  const junked = smtp.messages[2];
  record(
    "an unknown service is dropped",
    junk.ok && Boolean(junked) && !decode(junked.body).includes("script"),
    "",
  );

  // ------------------------------------------------------ the minimum enquiry
  const minimal = await submitEnquiry(
    formOf({ name: "Blessing", phone: "0772958986" }),
  );
  record("a name and a number is enough", minimal.ok, minimal.error ?? "");
  const second = smtp.messages[3];
  record(
    "it says they left no email",
    Boolean(second && decode(second.body).includes("no email address")),
    "",
  );

  // -------------------------------------------------------------- refusals
  const noName = await submitEnquiry(formOf({ name: "", phone: "0772958986" }));
  record("a missing name is refused", !noName.ok && noName.field === "name", noName.error ?? "");

  const noPhone = await submitEnquiry(formOf({ name: "Tarisai", phone: "12" }));
  record(
    "a missing number is refused",
    !noPhone.ok && noPhone.field === "phone",
    noPhone.error ?? "",
  );

  const badEmail = await submitEnquiry(
    formOf({ name: "Tarisai", phone: "0772958986", email: "not-an-address" }),
  );
  record(
    "a malformed email is refused",
    !badEmail.ok && badEmail.field === "email",
    badEmail.error ?? "",
  );

  const countBefore = smtp.messages.length;
  const bot = await submitEnquiry(
    formOf({ name: "Bot", phone: "0772958986", website: "http://spam.example" }),
  );
  record(
    "the honeypot swallows a bot",
    bot.ok && smtp.messages.length === countBefore,
    "accepted without sending, so the bot learns nothing",
  );

  // What the form is actually wired to. useActionState hands the action the
  // previous result first, so a wrapper that dropped or reordered its
  // arguments would send an empty enquiry and pass every check above.
  const sentBefore = smtp.messages.length;
  const viaAction = await submitEnquiryAction(
    null,
    formOf({ name: "Rudo Chikwanha", phone: "0772958986", origin: "Mutare" }),
  );
  const lastBody = decode(smtp.messages[smtp.messages.length - 1]?.body ?? "");
  record(
    "the form's own action sends",
    viaAction.ok &&
      smtp.messages.length === sentBefore + 1 &&
      lastBody.includes("Rudo Chikwanha"),
    "submitEnquiryAction(previous, formData) — the shape useActionState calls",
  );

  const refusedByAction = await submitEnquiryAction(
    viaAction,
    formOf({ name: "", phone: "0772958986" }),
  );
  record(
    "the action refuses what the plain call refuses",
    !refusedByAction.ok && refusedByAction.field === "name",
    "a previous success does not carry over into the next submit",
  );
} finally {
  smtp.stop();
}

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0
      ? " Every enquiry reaches operations@ and admin@wd-logistics.co.zw."
      : ""),
);
process.exit(failed === 0 ? 0 : 1);
