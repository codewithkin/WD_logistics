/**
 * A live check of the three things the assistant was reported as unable to do.
 *
 *   bunx tsx scripts/live-capability-check.ts
 *
 * ⚠️ Costs real tokens. It runs one turn per case against the real model, with
 * the app running on WEB_APP_URL, and creates one real user (removed at the
 * end). It does not touch WhatsApp — the delivery layer is checked separately
 * by app/scripts/tests/check-document-handoff.ts.
 *
 * The three:
 *
 *   1. **It cannot invite new users.** The operation was there and worked when
 *      called directly, so what needed proving is that the model reaches for
 *      it when an admin asks in the words an admin would use.
 *   2. **It refuses to generate reports / generates but cannot send.** Proves
 *      the model calls generate_report and that a file comes back attached to
 *      the reply — the thing the WhatsApp layer then delivers.
 *   3. **It cannot read images.** A photographed receipt now goes to the model
 *      as a picture rather than as a sentence saying a file exists somewhere.
 *      This sends one and checks the figures on it come back.
 *
 * Needs the admin contact from live-assistant-check.ts (+263772958986).
 */

import "dotenv/config";
import { answerMessage } from "../src/agents/assistant";
import { ASSISTANT_MODEL } from "../src/lib/model";

const OWNER = "0772958986";

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(46)} ${note}`);
}

/**
 * A receipt, drawn rather than photographed.
 *
 * A PNG built by hand here would be a blank rectangle; what is needed is
 * something with legible figures on it, so this is an SVG rendered to PNG by
 * nothing at all — SVG is not an image type most vision models accept, so it
 * is sent as a data URL of a real PNG produced below with a tiny bitmap
 * font. Keeping it in the repo as base64 would be worse: nobody could tell
 * what it says without decoding it.
 */
async function receiptPng(): Promise<{ base64: string; mimeType: string }> {
  const { createCanvas } = await import("@napi-rs/canvas").catch(() => ({
    createCanvas: null as never,
  }));

  if (!createCanvas) {
    throw new Error(
      "This check needs @napi-rs/canvas to draw the test receipt:\n" +
        "  bun add -d @napi-rs/canvas",
    );
  }

  const canvas = createCanvas(420, 300);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 420, 300);
  ctx.fillStyle = "#111111";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("ZUVA PETROLEUM", 24, 48);
  ctx.font = "20px sans-serif";
  ctx.fillText("Mutare Depot", 24, 82);
  ctx.fillText("30 Sep 2026", 24, 112);
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("DIESEL", 24, 160);
  ctx.font = "22px sans-serif";
  ctx.fillText("54.0 litres", 24, 196);
  ctx.fillText("@ $1.60 / litre", 24, 228);
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("TOTAL  $86.40", 24, 272);

  return {
    base64: canvas.toBuffer("image/png").toString("base64"),
    mimeType: "image/png",
  };
}

/**
 * Delete the account the invite check created, and everything hanging off it.
 *
 * This used to import the app's Prisma client across the package boundary,
 * which never resolved from here — so every run left a real user behind and
 * printed a note asking someone to go and delete it. The agent already has
 * `pg` and DATABASE_URL for the WhatsApp session store.
 *
 * Better-auth spreads a user across member, account and session rows, all
 * with foreign keys back to user, so deleting the user alone fails on those.
 */
async function removeUser(email: string): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log(`   ! DATABASE_URL is not set, so ${email} is still there. Remove it by hand.`);
    return;
  }

  const { Client } = await import("pg");
  const db = new Client({ connectionString });
  try {
    await db.connect();
    const found = await db.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [email],
    );
    if (found.rows.length === 0) {
      console.log(`   ! ${email} was never created, so there was nothing to clean up.`);
      return;
    }
    const id = found.rows[0]!.id;
    for (const table of ["member", "account", "session"]) {
      await db.query(`DELETE FROM "${table}" WHERE "userId" = $1`, [id]);
    }
    await db.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    console.log(`   removed ${email}`);
  } catch (error) {
    console.log(`   ! could not remove ${email}: ${String(error)}. Remove it by hand.`);
  } finally {
    await db.end().catch(() => {});
  }
}


console.log(`model: ${ASSISTANT_MODEL}\n`);

// ---------------------------------------------------------------- 1. invites
{
  const email = `livecheck-${Date.now()}@wd.test`;
  const reply = await answerMessage({
    phone: OWNER,
    message: `Add Tendai Marufu to the system as a supervisor, his email is ${email}`,
    remember: false,
  });
  const called = reply.toolCalls.map((c) => c.tool);
  record(
    "an admin can invite someone",
    called.includes("create_user"),
    called.length ? `called ${called.join(", ")}` : "no tool call at all",
  );
  record(
    "and is told what happened",
    /supervisor/i.test(reply.text) && /tendai/i.test(reply.text),
    reply.text.replace(/\s+/g, " ").slice(0, 110),
  );

  // Clean up the account it just made.
  //
  // This used to import the app's Prisma client across the package boundary,
  // which never resolved from here — so every run left a real user behind and
  // printed a note asking someone to go and delete it. The agent already has
  // `pg` and DATABASE_URL for the WhatsApp session store; one statement is
  // less machinery than a cross-package import that does not work.
  await removeUser(email);
}

// ---------------------------------------------------------------- 2. reports
{
  const reply = await answerMessage({
    phone: OWNER,
    message: "Send me the expenses report for last month as a PDF",
    remember: false,
  });
  const called = reply.toolCalls.map((c) => c.tool);
  record(
    "a report is produced when one is asked for",
    called.includes("generate_report"),
    called.length ? `called ${called.join(", ")}` : "no tool call at all",
  );
  const file = reply.attachments[0];
  record(
    "the file comes back with the reply",
    Boolean(file),
    file
      ? `${file.filename} · ${Math.round((file.base64.length * 3) / 4 / 1024)}KB · ${file.mimeType}`
      : "nothing attached — the WhatsApp layer would have had nothing to send",
  );
  record(
    "and it says it is sending, not that it emailed it",
    !/emailed|sent to your (in)?box/i.test(reply.text),
    reply.text.replace(/\s+/g, " ").slice(0, 110),
  );
}

// ----------------------------------------------------------------- 3. photos
{
  const image = await receiptPng();
  const reply = await answerMessage({
    phone: OWNER,
    message: "What does this receipt say? Don't record anything yet.",
    images: [image],
    remember: false,
  });
  const said = reply.text.replace(/\s+/g, " ");
  record(
    "the total on a photographed receipt is read",
    /86[.,]40/.test(said),
    said.slice(0, 110),
  );
  record(
    "and the litres with it",
    /54/.test(said),
    /54/.test(said) ? "54 litres" : "did not mention the quantity",
  );
}

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length} checks, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
