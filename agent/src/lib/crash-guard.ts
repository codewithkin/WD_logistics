/**
 * Keeps a dying Chromium from taking the whole service with it.
 *
 * whatsapp-web.js registers this on the Puppeteer page:
 *
 *   this.pupPage.on('framenavigated', async (frame) => {
 *     ...
 *     await this.inject();
 *   });
 *
 * An async listener nobody awaits. When WhatsApp Web navigates — a logout, a
 * reconnect, a session it has decided to invalidate — `inject()` is left
 * evaluating against a page that no longer exists and rejects with
 * "Execution context was destroyed, most likely because of a navigation".
 * Nothing is there to catch it, so it becomes an unhandled rejection, and
 * Node has terminated the process on those since v15.
 *
 * This is why wrapping `client.initialize()` in try/catch never helped: by
 * the time the listener fires, that promise resolved minutes ago.
 *
 * In production it read as the pairing being lost on every redeploy. It was
 * not: the logs show the session restored from Postgres each boot, 2.1 MB,
 * intact. What followed was the container dying ~18 seconds later, Coolify
 * restarting it, and the same thing again every 27 seconds. A session that
 * never gets a stable run also never gets its periodic backup written, so
 * over a few hundred restarts the stored pairing goes stale for real — the
 * symptom eventually becomes the cause.
 *
 * ## Why this is not a blanket catch
 *
 * Swallowing every unhandled rejection turns real bugs into silent wrong
 * answers, which on a service that reports financial figures is worse than a
 * crash. Only errors that mean "the browser went away" are survivable here.
 * Anything else is re-thrown and still ends the process, exactly as now.
 */

/**
 * Errors that only ever mean the Chromium page or its context has gone.
 * Every one of these is recoverable: the WhatsApp client is finished, the
 * HTTP API is not.
 */
const BROWSER_IS_GONE = [
  /Execution context was destroyed/i,
  /Target closed/i,
  /Session closed/i,
  /Protocol error/i,
  /Navigating frame was detached/i,
  /Most likely the page has been closed/i,
];

function isBrowserGone(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return BROWSER_IS_GONE.some((pattern) => pattern.test(message));
}

/**
 * @param onBrowserLost told when the browser died, so the WhatsApp status
 *        can stop claiming "ready" to anyone who asks. The HTTP API stays up
 *        either way; what changes is that it now answers honestly.
 */
export function installCrashGuard(onBrowserLost?: (error: unknown) => void): void {
  process.on("unhandledRejection", (reason) => {
    if (isBrowserGone(reason)) {
      console.error(
        "⚠️  [whatsapp] the browser page went away mid-operation. Staying up; " +
          "the WhatsApp client is no longer connected and may need re-pairing " +
          "under Settings → WhatsApp assistant.",
        reason instanceof Error ? reason.message : reason,
      );
      onBrowserLost?.(reason);
      return;
    }

    // Not ours to excuse. Restore what Node would have done, rather than
    // leaving the process running in a state nobody reasoned about.
    console.error("💥 Unhandled rejection, shutting down:", reason);
    throw reason;
  });

  process.on("uncaughtException", (error) => {
    if (isBrowserGone(error)) {
      console.error(
        "⚠️  [whatsapp] the browser threw on the way out. Staying up.",
        error.message,
      );
      onBrowserLost?.(error);
      return;
    }

    console.error("💥 Uncaught exception, shutting down:", error);
    process.exit(1);
  });
}
