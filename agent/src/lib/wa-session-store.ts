/**
 * Keeps the WhatsApp session in Postgres instead of on the container's disk.
 *
 * whatsapp-web.js's LocalAuth stores the pairing inside a Chromium profile
 * directory. That works on a laptop and fails on a hosted deploy: the
 * container filesystem is replaced on every build, so any redeploy — even a
 * one-line change — lost the session and demanded a fresh QR scan. Mounting a
 * volume helps only until the volume moves or the service is recreated.
 *
 * RemoteAuth solves it by zipping the profile and handing the archive to a
 * store. This is that store, backed by the same database the app already
 * uses, so the session survives anything short of losing Postgres itself.
 *
 * **A deliberate exception to the architecture.** CLAUDE.md says the agent
 * never touches Postgres and talks to the app over HTTP for everything. That
 * still holds for business data. This is not business data: it is an opaque
 * archive of browser state, several megabytes of it, written roughly once a
 * minute. Pushing that through the app as base64 would be slower, larger and
 * no safer. One table, one blob, no joins, no reads of anything else.
 */

import fs from "fs";
import path from "path";
import { Pool } from "pg";

const TABLE = "whatsapp_session";

/** The places RemoteAuth has put the archive, newest convention first. */
export function sessionArchiveCandidates(dataPath: string, session: string): string[] {
  return [
    // Current whatsapp-web.js: RemoteAuth.compressSession() writes
    // path.join(this.dataPath, `${this.sessionName}.zip`).
    path.join(path.resolve(dataPath), `${session}.zip`),
    // Older versions wrote it relative to the working directory.
    path.resolve(`${session}.zip`),
  ];
}

/**
 * Finds the archive RemoteAuth just wrote, or explains where it looked.
 *
 * Exported so scripts/check-whatsapp-session.ts can prove the convention
 * still matches the installed library — guessing it wrong is what produced
 * `ENOENT ... open 'RemoteAuth-agent-whatsapp.zip'` on every backup.
 */
export async function resolveSessionArchive(
  dataPath: string,
  session: string,
): Promise<string> {
  const candidates = sessionArchiveCandidates(dataPath, session);

  for (const candidate of candidates) {
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      // Try the next one.
    }
  }

  throw new Error(
    `RemoteAuth did not leave an archive for "${session}". Looked in: ${candidates.join(", ")}`,
  );
}

/**
 * Created here as well as in the app's Prisma schema.
 *
 * The schema is the canonical definition, but the agent can start before the
 * app has run its migrations — on a fresh stack, or when the two deploy
 * independently. Creating it if absent removes that ordering dependency, and
 * is a no-op once the migration has run.
 *
 * **Must stay byte-for-byte equivalent to what the migration produces**
 * (app/prisma/migrations/20260924123653_whatsapp_remote_session). Whichever
 * of the two gets there first is the shape the database keeps, so if they
 * disagree the table silently differs between deployments and Prisma reports
 * drift against a table it never writes to. `updated_at` used to be
 * `TIMESTAMPTZ DEFAULT now()` here and `TIMESTAMP(3) DEFAULT
 * CURRENT_TIMESTAMP` there; the migration's spelling is the one Prisma's
 * DateTime maps to, so it wins.
 */
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    session     TEXT PRIMARY KEY,
    data        BYTEA NOT NULL,
    size_bytes  INTEGER NOT NULL,
    updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export class PostgresSessionStore {
  private pool: Pool;
  private ready: Promise<void> | null = null;
  private dataPath: string;

  /**
   * @param dataPath the same directory handed to RemoteAuth's `dataPath`.
   *                 It is where the library writes the archive, and it does
   *                 not tell the store where that is — see save().
   */
  constructor(connectionString: string, dataPath: string) {
    this.dataPath = path.resolve(dataPath);
    this.pool = new Pool({
      connectionString,
      // One or two connections is plenty: this is touched on boot and then
      // once a minute. A large pool would sit idle holding server slots.
      max: 2,
      idleTimeoutMillis: 30_000,
      // Managed Postgres almost always terminates TLS; `sslmode` in the URL
      // still governs it, this only stops node rejecting a self-signed chain.
      ssl: /sslmode=(require|verify)/.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  /** Runs once; every entry point awaits it so the table is guaranteed. */
  private ensureTable(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool.query(CREATE_TABLE).then(() => undefined);
    }
    return this.ready;
  }

  async sessionExists(options: { session: string }): Promise<boolean> {
    await this.ensureTable();
    const result = await this.pool.query(
      `SELECT 1 FROM ${TABLE} WHERE session = $1 LIMIT 1`,
      [options.session],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Where RemoteAuth just wrote the archive.
   *
   * `store.save()` is called with the session name and nothing else, so the
   * store has to know the path by convention — and the convention changed.
   * Current whatsapp-web.js compresses to `<dataPath>/<session>.zip`
   * (RemoteAuth.compressSession), older versions wrote `<session>.zip`
   * relative to the working directory. Reading the old location against the
   * current library is what produced
   *
   *   ENOENT: no such file or directory, open 'RemoteAuth-agent-whatsapp.zip'
   *
   * on every single backup. Try where the library puts it now, fall back to
   * the old spot, so neither version breaks us.
   */
  private locateArchive(session: string): Promise<string> {
    return resolveSessionArchive(this.dataPath, session);
  }

  /**
   * Stores the archive RemoteAuth has just written.
   *
   * **Never throws.** RemoteAuth calls this from an un-caught `setInterval`
   * (its backupSync) and from afterAuthReady, so a rejection here becomes an
   * unhandled rejection and Node kills the agent — which is exactly what
   * happened: a backup failure took down a perfectly healthy WhatsApp
   * connection, and the restart then tripped over the session lock the dead
   * process had left behind.
   *
   * A failed backup is not fatal. The live session is still in Chromium and
   * the next cycle tries again; what matters is that the failure is loud and
   * that `lastSavedAt` visibly stops advancing.
   */
  async save(options: { session: string }): Promise<void> {
    try {
      await this.ensureTable();
      const file = await this.locateArchive(options.session);
      const data = await fs.promises.readFile(file);

      await this.pool.query(
        `INSERT INTO ${TABLE} (session, data, size_bytes, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (session) DO UPDATE
           SET data = EXCLUDED.data,
               size_bytes = EXCLUDED.size_bytes,
               updated_at = now()`,
        [options.session, data, data.length],
      );

      console.log(
        `💾 [whatsapp] session saved to Postgres (${(data.length / 1024 / 1024).toFixed(1)} MB)`,
      );
    } catch (error) {
      console.error(
        `❌ [whatsapp] session backup failed; the pairing is still live but is ` +
          `no longer being copied to Postgres, so a redeploy would lose it. ` +
          `Retrying on the next backup cycle.`,
        error,
      );
    }
  }

  /** Writes the stored archive to the path RemoteAuth asks for. */
  async extract(options: { session: string; path: string }): Promise<void> {
    await this.ensureTable();
    const result = await this.pool.query<{ data: Buffer }>(
      `SELECT data FROM ${TABLE} WHERE session = $1`,
      [options.session],
    );

    const row = result.rows[0];
    if (!row) {
      // sessionExists() is checked first by RemoteAuth, so this means the row
      // vanished between the two calls. Better to say so than write an empty
      // file and have Chromium fail on a corrupt profile.
      throw new Error(`No stored WhatsApp session named "${options.session}".`);
    }

    await fs.promises.writeFile(options.path, row.data);
    console.log(
      `📦 [whatsapp] session restored from Postgres (${(row.data.length / 1024 / 1024).toFixed(1)} MB)`,
    );
  }

  async delete(options: { session: string }): Promise<void> {
    await this.ensureTable();
    await this.pool.query(`DELETE FROM ${TABLE} WHERE session = $1`, [
      options.session,
    ]);
    console.log(`🗑️  [whatsapp] stored session "${options.session}" removed`);
  }

  /** For the status endpoint: when was the session last backed up? */
  async lastSavedAt(session: string): Promise<Date | null> {
    await this.ensureTable();
    const result = await this.pool.query<{ updated_at: Date }>(
      `SELECT updated_at FROM ${TABLE} WHERE session = $1`,
      [session],
    );
    return result.rows[0]?.updated_at ?? null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
