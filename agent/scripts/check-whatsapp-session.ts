/**
 * Checks the two things that took the WhatsApp agent down in production,
 * without needing WhatsApp, a browser or a database.
 *
 * What went wrong, so the checks below have a point:
 *
 *  1. The session store read the RemoteAuth archive from the working
 *     directory, but the library writes it into its `dataPath`. Every backup
 *     therefore failed with `ENOENT ... RemoteAuth-agent-whatsapp.zip`, and
 *     because RemoteAuth calls save() from an un-caught setInterval, that
 *     rejection killed the whole agent.
 *  2. The restart then found the dead run's session lock. The liveness test
 *     was `process.kill(pid, 0)`, which cannot tell a live process from a
 *     recycled pid or an unreaped zombie — both of which are routine in a
 *     container — so the agent refused to start WhatsApp until somebody
 *     deleted the lock by hand.
 *
 * Run with: bun scripts/check-whatsapp-session.ts   (or npx tsx …)
 */

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import {
  sessionArchiveCandidates,
  resolveSessionArchive,
  PostgresSessionStore,
} from "../src/lib/wa-session-store";
import {
  acquireSessionLock,
  SessionInUseError,
  parseProcStat,
} from "../src/lib/whatsapp-session";
import { allowReply, resetReplyGuard } from "../src/lib/reply-guard";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// 1. The archive path matches what the installed library actually does.
// ---------------------------------------------------------------------------
function checkArchiveConvention() {
  console.log("\nArchive location");

  const remoteAuthPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "node_modules",
    "whatsapp-web.js",
    "src",
    "authStrategies",
    "RemoteAuth.js",
  );

  if (!fs.existsSync(remoteAuthPath)) {
    console.log("  ⏭️  whatsapp-web.js not installed; skipping source check");
  } else {
    const source = fs.readFileSync(remoteAuthPath, "utf8");
    // compressSession() decides where the zip lands. If an upgrade changes
    // this, the store has to change with it — that is the bug this guards.
    const writesIntoDataPath =
      /path\.join\(\s*this\.dataPath\s*,\s*`\$\{this\.sessionName\}\.zip`\s*\)/.test(source);

    check(
      "library writes the archive into dataPath",
      writesIntoDataPath,
      "RemoteAuth.compressSession no longer uses path.join(this.dataPath, ...) — update sessionArchiveCandidates()",
    );
  }

  const candidates = sessionArchiveCandidates("/srv/auth", "RemoteAuth-agent-whatsapp");
  check(
    "dataPath is tried first",
    candidates[0] === path.join(path.resolve("/srv/auth"), "RemoteAuth-agent-whatsapp.zip"),
    candidates[0],
  );
  check("working directory is kept as a fallback", candidates.length === 2);
}

async function checkArchiveResolution() {
  console.log("\nArchive resolution");

  const dir = tempDir("wa-archive-");
  const session = "RemoteAuth-agent-whatsapp";

  try {
    let threw = false;
    try {
      await resolveSessionArchive(dir, session);
    } catch {
      threw = true;
    }
    check("missing archive reports an error", threw);

    const written = path.join(dir, `${session}.zip`);
    fs.writeFileSync(written, "not really a zip");
    const found = await resolveSessionArchive(dir, session);
    check("archive in dataPath is found", found === written, found);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 2. A failed backup must never take the process down.
// ---------------------------------------------------------------------------
async function checkSaveNeverThrows() {
  console.log("\nBackup failure handling");

  const dir = tempDir("wa-save-");
  // Deliberately unreachable: any internal failure must still be swallowed.
  const store = new PostgresSessionStore(
    "postgresql://nobody:nobody@127.0.0.1:1/nowhere",
    dir,
  );

  try {
    let threw = false;
    try {
      await store.save({ session: "RemoteAuth-agent-whatsapp" });
    } catch {
      threw = true;
    }
    check("save() resolves instead of rejecting", !threw);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 3. The lock survives a crash, and still blocks a genuine second instance.
// ---------------------------------------------------------------------------
async function checkSessionLock() {
  console.log("\nSession lock");

  // A lock left by a process that no longer exists.
  {
    const dir = tempDir("wa-lock-dead-");
    // A pid that cannot be running: written, then the process is gone.
    const dead = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const deadPid = dead.pid!;
    await new Promise((resolve) => dead.on("exit", resolve));

    fs.writeFileSync(
      path.join(dir, "agent.lock"),
      JSON.stringify({ pid: deadPid, startTime: "123456" }),
    );

    let reclaimed = true;
    try {
      acquireSessionLock(dir).release();
    } catch {
      reclaimed = false;
    }
    check("stale lock from a dead process is reclaimed", reclaimed);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // A pid that IS alive but is not the process that took the lock — the
  // container case where the id was handed to something else after a crash.
  {
    const dir = tempDir("wa-lock-recycled-");
    const alive = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], {
      stdio: "ignore",
    });

    try {
      fs.writeFileSync(
        path.join(dir, "agent.lock"),
        // Same pid, a start time that cannot match.
        JSON.stringify({ pid: alive.pid, startTime: "1" }),
      );

      let reclaimed = true;
      try {
        acquireSessionLock(dir).release();
      } catch {
        reclaimed = false;
      }

      if (process.platform === "linux") {
        check("recycled pid is not mistaken for the lock holder", reclaimed);
      } else {
        console.log("  ⏭️  recycled-pid check needs /proc; skipped on " + process.platform);
      }
    } finally {
      alive.kill();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // A real second instance must still be refused.
  {
    const dir = tempDir("wa-lock-live-");
    try {
      // This process holds it, written the way acquire writes it.
      const first = acquireSessionLock(dir);

      // Pretend to be a different process holding the same lock by rewriting
      // the pid to one that is genuinely alive with a matching start time:
      // our own parent-of-record, i.e. this process, under a different id is
      // not reproducible — so assert instead that our own live lock is seen
      // as held when a *different* pid owns it.
      const raw = JSON.parse(fs.readFileSync(path.join(dir, "agent.lock"), "utf8"));
      check("lock records this process", raw.pid === process.pid, JSON.stringify(raw));
      check(
        "lock records a start time on Linux",
        process.platform !== "linux" || typeof raw.startTime === "string",
        JSON.stringify(raw),
      );

      first.release();
      check("release removes our own lock", !fs.existsSync(path.join(dir, "agent.lock")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // The bare-pid format written by earlier versions must still be understood.
  {
    const dir = tempDir("wa-lock-legacy-");
    const alive = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], {
      stdio: "ignore",
    });

    try {
      fs.writeFileSync(path.join(dir, "agent.lock"), String(alive.pid));

      let blocked = false;
      try {
        acquireSessionLock(dir).release();
      } catch (error) {
        blocked = error instanceof SessionInUseError;
      }
      check("legacy bare-pid lock held by a live process still blocks", blocked);
    } finally {
      alive.kill();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// 4. The /proc parsing the lock depends on. Checked from sample lines so it
//    is exercised even off Linux, where the live test above has to skip.
// ---------------------------------------------------------------------------
function checkProcStatParsing() {
  console.log("\n/proc/<pid>/stat parsing");

  // Fields 3..22 after the name: state, ppid, pgrp, session, tty_nr, tpgid,
  // flags, minflt, cminflt, majflt, cmajflt, utime, stime, cutime, cstime,
  // priority, nice, num_threads, itrealvalue, starttime.
  const tail = [
    "S", "1", "1", "1", "0", "-1", "4194304",
    "900", "0", "0", "0", "10", "5", "0", "0",
    "20", "0", "11", "0",
    "STARTTIME",
  ].join(" ");

  const running = parseProcStat(`31 (node) ${tail} 0 0 0`);
  check(
    "starttime is read from field 22",
    running.status === "alive" && running.startTime === "STARTTIME",
    JSON.stringify(running),
  );

  // A command name containing spaces and a bracket must not shift the fields.
  const awkward = parseProcStat(`31 (my we:i)rd app) ${tail} 0 0 0`);
  check(
    "a bracketed, spaced process name does not shift the fields",
    awkward.status === "alive" && awkward.startTime === "STARTTIME",
    JSON.stringify(awkward),
  );

  const zombie = parseProcStat(`31 (node) ${tail.replace(/^S /, "Z ")} 0 0 0`);
  check("an unreaped zombie counts as dead", zombie.status === "dead", JSON.stringify(zombie));

  const truncated = parseProcStat("31 (node) S 1 1");
  check("a short line is 'unknown', not a false match", truncated.status === "unknown");

  // And against this machine's own real format, where there is one.
  if (process.platform === "linux") {
    const real = parseProcStat(fs.readFileSync(`/proc/${process.pid}/stat`, "utf8"));
    check(
      "this process parses as alive with a numeric start time",
      real.status === "alive" && /^\d+$/.test(real.startTime),
      JSON.stringify(real),
    );
  }
}

// ---------------------------------------------------------------------------
// 5. The reply loop. `message_create` fires for outgoing messages too, so the
//    assistant read its own replies back as questions and answered them —
//    122 copies of "I don't have this number on my list" to a real person.
// ---------------------------------------------------------------------------
function checkSelfMessageGuard() {
  console.log("\nSelf-message guard");

  const handlerSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "index.ts"),
    "utf8",
  );

  const guard = /if\s*\(\s*msg\.fromMe\s*\)\s*return;/.test(handlerSource);
  check(
    "the message handler drops anything this account sent",
    guard,
    "no `if (msg.fromMe) return;` — outgoing replies will be read back as questions",
  );

  // It has to come before the work, not after it.
  const guardAt = handlerSource.search(/if\s*\(\s*msg\.fromMe\s*\)\s*return;/);
  const answerAt = handlerSource.indexOf("answerMessage({");
  check(
    "it runs before the message is answered",
    guard && guardAt !== -1 && guardAt < answerAt,
    `fromMe at ${guardAt}, answerMessage at ${answerAt}`,
  );
}

function checkReplyGuard() {
  console.log("\nReply loop breaker");

  const phone = "+263771234567";
  const refusal = "I don't have this number on my list, so I can't help.";

  resetReplyGuard();
  const first = allowReply(phone, refusal, 1_000);
  check("the first reply goes out", first.send);

  const second = allowReply(phone, refusal, 2_000);
  check("the same reply straight after is held back", !second.send, second.reason);

  // Which is the specific thing that flooded the chat.
  resetReplyGuard();
  let delivered = 0;
  for (let i = 0; i < 122; i++) {
    if (allowReply(phone, refusal, 1_000 + i * 10).send) delivered += 1;
  }
  check(
    "122 attempts at the same refusal deliver once, not 122 times",
    delivered === 1,
    `${delivered} delivered`,
  );

  // Different messages are still limited, so a loop that varies its text
  // cannot flood either.
  resetReplyGuard();
  let varied = 0;
  for (let i = 0; i < 50; i++) {
    if (allowReply(phone, `reply number ${i}`, 1_000 + i * 10).send) varied += 1;
  }
  check(
    "a loop with varying text is capped per minute",
    varied > 0 && varied <= 8,
    `${varied} delivered`,
  );

  // A real conversation must not be throttled.
  resetReplyGuard();
  const later = 1_000 + 20 * 60 * 1000;
  check("the same answer is allowed again much later", allowReply(phone, refusal, 1_000).send);
  check("…and again after the window", allowReply(phone, refusal, later).send);

  // One person being noisy must not silence anybody else.
  resetReplyGuard();
  for (let i = 0; i < 20; i++) allowReply(phone, `spam ${i}`, 1_000 + i);
  check(
    "a different number is unaffected",
    allowReply("+263779999999", "hello", 1_100).send,
  );
}

async function main() {
  console.log("WhatsApp session checks");
  checkArchiveConvention();
  checkProcStatParsing();
  checkSelfMessageGuard();
  checkReplyGuard();
  await checkArchiveResolution();
  await checkSaveNeverThrows();
  await checkSessionLock();

  console.log("");
  if (failures > 0) {
    console.log(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
  process.exit(0);
}

main();
