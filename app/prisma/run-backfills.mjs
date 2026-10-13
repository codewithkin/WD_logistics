// Runs every backfill in prisma/, on every deployment.
//
// WHY THIS EXISTS
//
// A backfill reconciles data already on record with a change in behaviour:
// trips invoiced before invoicing wrote revenue, parts fitted before fitting
// one posted a cost. Each is written to be run by hand, dry-run first, with
// the output read before anything is applied — which is the right way round
// when somebody can get to a shell.
//
// Nobody can here. The services run on Coolify against the production
// database, and the only moment anything gets to run against it is container
// start. So they run here, with `--apply`, every deploy. The client asked for
// exactly this on 13 Oct, knowing it means the dry run is a log entry after
// the fact rather than a decision before it.
//
// WHAT MAKES THAT SAFE
//
// 1. **Every backfill is idempotent.** A trip whose revenue already matches
//    its invoices is skipped; an allocation that already has an expense is
//    skipped. The second run of any of them is a no-op, which is what makes
//    running them on every boot different from running them twice.
// 2. **They refuse to guess.** A part with no cost, an item with no expense
//    category, a destination matching no vehicle: each is listed and left
//    alone rather than filed somewhere plausible. That list is the thing to
//    read in the deploy log.
// 3. **One instance at a time.** A Postgres advisory lock means a second
//    replica booting beside the first does not post the same cost twice.
// 4. **A failure does not take the site down.** A broken backfill is a data
//    problem; refusing to start the server over it would be an outage. Each
//    one's exit status is reported and the deploy continues.
//
// ADDING ANOTHER
//
// Drop `prisma/backfill-<name>.ts` in. It is picked up by name order, run
// with `--apply`, and nothing here needs editing. Give it the same manners as
// its siblings: dry run by default, `--apply` to write, idempotent, and
// silent about rows it cannot decide.
//
// Set SKIP_BACKFILLS=true to stop all of this for one deployment — the
// escape hatch for a backfill that is misbehaving against real data.

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

/** One fixed key, so every replica contends for the same lock. */
const LOCK_KEY = 72707370;

function log(message) {
  console.log(`[backfills] ${message}`);
}

if (process.env.SKIP_BACKFILLS === "true") {
  log("SKIP_BACKFILLS=true — skipping.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  log("no DATABASE_URL — skipping.");
  process.exit(0);
}

// Named `backfill-*.ts`, in name order. Dated names therefore run oldest
// first, which is the order they were written to be applied in.
const scripts = readdirSync(here)
  .filter((name) => name.startsWith("backfill-") && name.endsWith(".ts"))
  .sort();

if (scripts.length === 0) {
  log("none to run.");
  process.exit(0);
}

// A single client, not a pool: an advisory lock belongs to one session, and a
// pooled query can be handed back on a different connection than it was taken
// on — which would release nothing.
const client = new pg.Client({ connectionString });
let holdsLock = false;

try {
  await client.connect();
  const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
  holdsLock = rows[0]?.locked === true;

  if (!holdsLock) {
    log("another instance is running them — skipping.");
    process.exit(0);
  }

  log(`${scripts.length} to run: ${scripts.join(", ")}`);

  const failed = [];
  for (const script of scripts) {
    log(`--- ${script} ---`);
    // A child process per script: each one disconnects its own Prisma client
    // and exits on failure, which is tidy in its own process and would take
    // this one down with it in-process. `bun` is on the image for the same
    // reason it is there for ensure-admin.mjs — these are TypeScript.
    const result = spawnSync("bun", [join(here, script), "--apply"], {
      stdio: "inherit",
      env: process.env,
    });

    if (result.error) {
      failed.push(`${script} (${result.error.message})`);
    } else if (result.status !== 0) {
      failed.push(`${script} (exit ${result.status})`);
    }
  }

  if (failed.length > 0) {
    // Loud, and not fatal. The server still starts; the rows these would have
    // reconciled stay as they are until the next deploy or a fixed script.
    log("================================================================");
    log(`FAILED: ${failed.join("; ")}`);
    log("The app is starting anyway — a backfill is data work, not a");
    log("precondition for serving. Read the output above before the next");
    log("deploy, since each one is idempotent and will try again.");
    log("================================================================");
  } else {
    log("all done.");
  }
} catch (error) {
  log(`could not run: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (holdsLock) {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  }
  await client.end().catch(() => {});
}

// Always zero: see the note on failures above.
process.exit(0);
