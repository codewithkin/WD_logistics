// Unwedges `prisma migrate deploy` when whatsapp_session already exists.
//
// THE FAILURE THIS RECOVERS FROM
//
// The agent creates whatsapp_session itself on boot (CREATE TABLE IF NOT
// EXISTS, see agent/src/lib/wa-session-store.ts) because it can start before
// the app has migrated. Nothing orders the two services, so on the deploy
// that first shipped this feature the agent won the race: by the time the
// app ran `migrate deploy`, the table was already there and the migration's
// plain CREATE TABLE failed with
//
//   ERROR: relation "whatsapp_session" already exists   (SQLSTATE 42P07)
//
// Prisma then records the migration as failed, and *every* later deploy
// stops before running anything:
//
//   Error: P3009  migrate found failed migrations in the target database
//
// which is why a database that already had the right table sat unable to
// deploy at all.
//
// WHAT THIS DOES
//
// Runs before `migrate deploy` (see the CMD in app/Dockerfile) and, only
// when the table is genuinely already present, tells Prisma the migration is
// done — `migrate resolve --applied`, the documented way to reconcile
// history with a table you already have. `migrate deploy` then skips it and
// carries on with the rest.
//
// It covers both orderings:
//   - the migration ran and failed on 42P07  (the stuck production case)
//   - the migration has not run yet because the agent created the table
//     first (the same race, caught before it can fail)
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It touches one named migration, and only when whatsapp_session exists. It
// never clears failed migrations in general — a migration that failed for a
// real reason must keep failing loudly rather than be marked done. And it
// does not edit the migration's SQL: rewriting an applied migration changes
// its checksum, which would upset every database that applied it cleanly.

import { execFileSync } from "node:child_process";
import pg from "pg";

const MIGRATION = "20260924123653_whatsapp_remote_session";
const TABLE = "whatsapp_session";
const LOG = "[resolve-whatsapp-session-migration]";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(`${LOG} DATABASE_URL is not set; leaving migrations alone.`);
    return;
  }

  const client = new pg.Client({
    connectionString,
    // Matches the agent's store: managed Postgres terminates TLS with a
    // chain node won't verify, and `sslmode` in the URL still decides
    // whether TLS is used at all.
    ssl: /sslmode=(require|verify)/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    // A database with no history at all is brand new: `migrate deploy` will
    // create everything in order and there is nothing to reconcile.
    if (!(await exists(client, "public._prisma_migrations"))) {
      return;
    }

    // If the table isn't there, the migration is free to create it normally.
    if (!(await exists(client, `public.${TABLE}`))) {
      return;
    }

    const { rows } = await client.query(
      `SELECT finished_at, rolled_back_at
         FROM _prisma_migrations
        WHERE migration_name = $1
        ORDER BY started_at DESC
        LIMIT 1`,
      [MIGRATION],
    );

    const record = rows[0];
    if (record && record.finished_at && !record.rolled_back_at) {
      return; // Already applied cleanly — nothing to do.
    }

    console.log(
      `${LOG} ${TABLE} exists but ${MIGRATION} is ${record ? "recorded as failed" : "not recorded"}; marking it applied.`,
    );
    execFileSync(
      "node_modules/.bin/prisma",
      ["migrate", "resolve", "--applied", MIGRATION],
      { stdio: "inherit" },
    );
  } finally {
    await client.end();
  }
}

/** to_regclass returns null rather than throwing when the name is unknown. */
async function exists(client, qualifiedName) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [qualifiedName],
  );
  return rows[0].present;
}

main().catch((error) => {
  // Stop loudly. Carrying on would just hand the same failure to
  // `migrate deploy` with less context about why.
  console.error(`${LOG} failed:`, error);
  process.exit(1);
});
