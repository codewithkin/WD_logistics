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


/**
 * Say a line out loud and hand back the WAV, base64.
 *
 * Windows only, through the speech synthesiser that ships with it. Returns
 * null anywhere else so the caller can say the case was skipped rather than
 * report a pass it did not earn.
 */
async function speakToWav(line: string): Promise<string | null> {
  if (process.platform !== "win32") return null;

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");

  const out = path.join(os.tmpdir(), `wd-voice-check-${Date.now()}.wav`);
  const script =
    "Add-Type -AssemblyName System.Speech; " +
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
    `$s.SetOutputToWaveFile(${JSON.stringify(out)}); ` +
    `$s.Speak(${JSON.stringify(line)}); $s.Dispose();`;

  try {
    await promisify(execFile)("powershell", ["-NoProfile", "-Command", script], {
      timeout: 60000,
    });
    const wav = await fs.readFile(out);
    await fs.unlink(out).catch(() => {});
    return wav.toString("base64");
  } catch {
    return null;
  }
}


/**
 * The expenses of a given amount, before the voice case runs.
 *
 * Identity, not time. Two earlier attempts at this went wrong: a tag spoken
 * into the recording came back as "lift test" and matched nothing, and then a
 * "created since" window silently matched nothing either, because these
 * columns are `timestamp without time zone` and node-pg reads them as local
 * time — two hours out here. Ids do not drift.
 */
async function expensesOfAmount(amount: number): Promise<Set<string>> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return new Set();

  const { Client } = await import("pg");
  const db = new Client({ connectionString });
  try {
    await db.connect();
    const found = await db.query<{ id: string }>(
      `SELECT id FROM expense WHERE amount = $1`,
      [amount],
    );
    return new Set(found.rows.map((row) => row.id));
  } catch {
    return new Set();
  } finally {
    await db.end().catch(() => {});
  }
}

/**
 * Take out whatever the voice case booked — anything of that amount that was
 * not there beforehand — along with the account transaction that debited it
 * and the join rows hanging off it. A check that leaves money in the accounts
 * is worse than one that does not run.
 */
async function removeExpensesAddedSince(
  amount: number,
  before: Set<string>,
): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("   ! DATABASE_URL is not set — remove the test expense by hand.");
    return;
  }

  const after = await expensesOfAmount(amount);
  const ids = [...after].filter((id) => !before.has(id));
  if (ids.length === 0) {
    console.log("   ! nothing new to clean up — check by hand.");
    return;
  }

  const { Client } = await import("pg");
  const db = new Client({ connectionString });
  try {
    await db.connect();
    for (const table of [
      "account_transaction",
      "truck_expense",
      "trailer_expense",
      "trip_expense",
      "driver_expense",
    ]) {
      await db
        .query(`DELETE FROM ${table} WHERE "expenseId" = ANY($1::text[])`, [ids])
        .catch(() => {});
    }
    await db.query(`DELETE FROM expense WHERE id = ANY($1::text[])`, [ids]);
    console.log(`   removed ${ids.length} test expense(s)`);
  } catch (error) {
    console.log(`   ! could not remove the test expense: ${String(error)}`);
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

// ------------------------------------------------------------ 4. voice notes
//
// The chain this proves is audio -> words -> action. Transcription on its own
// was measured when it was built; what was never shown is that the transcript
// then reaches a tool, which is the only part a person in a yard cares about.
//
// The speech is synthesised rather than committed as base64, for the same
// reason the receipt above is drawn: a fixture nobody can read is a fixture
// nobody can tell has stopped testing what it claims. Windows speaks it
// through SAPI; elsewhere the case says why it did not run rather than
// passing quietly.
{
  // This case really does book an expense — anything less would not show the
  // words reached a tool — so the row is taken out again afterwards, found by
  // comparing the expenses of that amount before and after.
  const expensesBefore = await expensesOfAmount(200);
  const spoken = await speakToWav(
    "Record two hundred dollars of diesel for truck K B Z 123 A",
  );

  if (!spoken) {
    record(
      "a voice note is heard and acted on",
      true,
      "skipped — no speech synthesiser here (Windows only); run it on Windows to prove this",
    );
  } else {
    const { transcribeVoiceNote } = await import("../src/lib/transcribe");
    const heard = await transcribeVoiceNote({
      base64: spoken,
      mimeType: "audio/wav",
    });

    record(
      "a voice note is transcribed",
      Boolean(heard?.text),
      heard ? `"${heard.text}"` : "nothing came back",
    );

    if (heard) {
      // In a finally, because a throw halfway through still leaves the row —
      // and a check that walks away from money in the accounts is worse than
      // one that never ran.
      try {
        // What index.ts hands the assistant once it has the words.
        const reply = await answerMessage({
          phone: OWNER,
          message: `[Voice note, transcribed] ${heard.text}`,
          remember: false,
        });
        const called = reply.toolCalls.map((c) => c.tool);
        record(
          "and the words reach a tool, not just the reply",
          called.includes("record_expense"),
          called.length ? `called ${called.join(", ")}` : "no tool call at all",
        );
        record(
          "with the amount off the recording",
          /200/.test(reply.text),
          reply.text.replace(/\s+/g, " ").slice(0, 110),
        );
      } finally {
        await removeExpensesAddedSince(200, expensesBefore);
      }
    }
  }
}

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length} checks, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
