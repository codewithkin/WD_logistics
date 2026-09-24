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
    const holder = Number.parseInt(raw, 10);

    if (Number.isFinite(holder) && holder !== process.pid && pidAlive(holder)) {
      throw new SessionInUseError(holder, lockPath);
    }

    // Left behind by a process that was killed — ours now.
    console.warn(
      `⚠️  [whatsapp] reclaiming a stale session lock from process ${raw || "?"}. ` +
        `If the session keeps dropping, the previous run did not shut down cleanly.`,
    );
  }

  fs.writeFileSync(lockPath, String(process.pid), "utf8");

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      try {
        // Only remove it if it is still ours; another process may have
        // reclaimed it after a stale-lock takeover.
        if (fs.existsSync(lockPath)) {
          const current = fs.readFileSync(lockPath, "utf8").trim();
          if (current === String(process.pid)) fs.unlinkSync(lockPath);
        }
      } catch {
        // A lock we cannot remove is reclaimed on the next boot by the
        // liveness check above, so this is not worth failing a shutdown for.
      }
    },
  };
}
