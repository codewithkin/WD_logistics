/**
 * Guards the Chromium profile the WhatsApp session lives in.
 *
 * whatsapp-web.js keeps the linked-device session inside a Chromium user-data
 * directory (`.wwebjs_auth/session-<clientId>`). Chromium profiles are
 * single-instance: point two browsers at one and the profile is corrupted,
 * WhatsApp drops the device, and the next boot shows a QR code again. From
 * the outside this looks like the session "unauthenticating by itself"
 * moments after a successful scan.
 *
 * Two things cause a second instance in practice:
 *
 *  - `bun run dev` is `tsx watch`, which restarts the process on every file
 *    save. Node dies without closing Chromium, so the old browser is still
 *    holding the profile when the new process opens it.
 *  - Running the agent twice by hand, or alongside a container.
 *
 * So: take a lock naming the pid that holds it, refuse to start a second
 * client against the same profile, and release it on the way out. A stale
 * lock from a process that no longer exists is reclaimed rather than
 * blocking a legitimate restart forever.
 */

import fs from "fs";
import path from "path";

export interface SessionLock {
  release: () => void;
}

/** True when a process with this id is still running. */
function pidAlive(pid: number): boolean {
  try {
    // Signal 0 performs the permission/existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to another user — still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export type ProcessState =
  | { status: "alive"; startTime: string }
  | { status: "dead" }
  | { status: "unknown" };

/**
 * Reads one line of /proc/<pid>/stat.
 *
 * Split out and exported so it can be checked on a machine without /proc —
 * the field arithmetic below is the sort of thing that is silently wrong by
 * one and then never noticed.
 */
export function parseProcStat(stat: string): ProcessState {
  // Field 2 is the executable name in parentheses and can itself contain
  // spaces and brackets, so everything is read relative to the last ')'.
  const close = stat.lastIndexOf(")");
  if (close === -1) return { status: "unknown" };

  const fields = stat.slice(close + 2).split(" ");

  // Those fields begin at proc field 3 (state), so starttime — field 22 —
  // sits at index 19.
  const state = fields[0];
  const startTime = fields[19];

  if (state === "Z") return { status: "dead" };
  if (!startTime) return { status: "unknown" };
  return { status: "alive", startTime };
}

/**
 * What Linux says about a process id, including when it started.
 *
 * `process.kill(pid, 0)` on its own is not enough to say "that process is
 * still the one that took the lock", for two reasons that both bite inside a
 * container:
 *
 *  - **Recycled ids.** A container's pid space starts at 1 and stays small,
 *    so when the agent crashes and its supervisor restarts it, the id the
 *    dead run held is very likely handed straight back out to something
 *    else. The signal check then says "alive" about an unrelated process.
 *  - **Zombies.** If nothing reaps children, a dead process keeps its pid
 *    entry and signal 0 happily succeeds against the corpse.
 *
 * Either way the lock looked held by a process that had actually died, and
 * the agent refused to start WhatsApp until the file was deleted by hand.
 * Start time separates them: a recycled id reports a different one, and a
 * zombie reports state `Z`.
 *
 * Only Linux exposes this. Elsewhere (a laptop) the answer is "unknown" and
 * the caller falls back to the signal check, which is fine there — the case
 * it guards against in development is `tsx watch` restarting, where the
 * previous process really is still running.
 */
function inspectProcess(pid: number): ProcessState {
  if (process.platform !== "linux") return { status: "unknown" };

  try {
    return parseProcStat(fs.readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return { status: "dead" }; // No /proc entry on Linux means it is gone.
  }
}

interface LockRecord {
  pid: number;
  startTime: string | null;
}

function serialiseLock(pid: number): string {
  const state = inspectProcess(pid);
  const record: LockRecord = {
    pid,
    startTime: state.status === "alive" ? state.startTime : null,
  };
  return JSON.stringify(record);
}

/** Reads both the current JSON form and the bare-pid form that preceded it. */
function parseLock(raw: string): LockRecord | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LockRecord>;
    if (typeof parsed.pid === "number" && Number.isFinite(parsed.pid)) {
      return {
        pid: parsed.pid,
        startTime: typeof parsed.startTime === "string" ? parsed.startTime : null,
      };
    }
  } catch {
    // Fall through to the legacy format.
  }

  const pid = Number.parseInt(raw, 10);
  return Number.isFinite(pid) ? { pid, startTime: null } : null;
}

/** True only when the process that wrote the lock is the one still running. */
function stillHeldBy(held: LockRecord): boolean {
  const state = inspectProcess(held.pid);

  if (state.status === "dead") return false;

  if (state.status === "alive") {
    // A start time that no longer matches means the id was recycled: this is
    // a different process wearing the dead one's pid.
    if (held.startTime && held.startTime !== state.startTime) return false;
    return true;
  }

  return pidAlive(held.pid);
}

export class SessionInUseError extends Error {
  constructor(public readonly holderPid: number, public readonly lockPath: string) {
    super(
      `The WhatsApp session is already open in process ${holderPid}. ` +
        `Running two clients against one Chromium profile corrupts it and logs the device out. ` +
        `Stop the other agent (or delete ${lockPath} if that process is gone) and start again.`,
    );
    this.name = "SessionInUseError";
  }
}

/**
 * Claims the profile for this process.
 *
 * @throws SessionInUseError when a live process already holds it.
 */
export function acquireSessionLock(authPath: string): SessionLock {
  fs.mkdirSync(authPath, { recursive: true });
  const lockPath = path.join(authPath, "agent.lock");

  if (fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, "utf8").trim();
    const held = parseLock(raw);

    if (held && held.pid !== process.pid && stillHeldBy(held)) {
      throw new SessionInUseError(held.pid, lockPath);
    }

    // Left behind by a process that died, or whose id has since been handed
    // to something else — ours now.
    console.warn(
      `⚠️  [whatsapp] reclaiming a stale session lock from process ${held?.pid ?? "?"}. ` +
        `If the session keeps dropping, the previous run did not shut down cleanly.`,
    );
  }

  fs.writeFileSync(lockPath, serialiseLock(process.pid), "utf8");

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      try {
        // Only remove it if it is still ours; another process may have
        // reclaimed it after a stale-lock takeover.
        if (fs.existsSync(lockPath)) {
          const current = parseLock(fs.readFileSync(lockPath, "utf8").trim());
          if (current?.pid === process.pid) fs.unlinkSync(lockPath);
        }
      } catch {
        // A lock we cannot remove is reclaimed on the next boot by the
        // liveness check above, so this is not worth failing a shutdown for.
      }
    },
  };
}
