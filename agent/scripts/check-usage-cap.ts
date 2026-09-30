/**
 * The cap as the agent enforces it — the half that actually goes quiet.
 *
 *   bun run check:cap
 *
 * Offline. `fetch` and the clock are both stubbed, so nothing here talks to
 * the app, the model or WhatsApp.
 *
 * The app owns the numbers (checked by app/scripts/tests/check-message-cap.ts).
 * This is the part that decides whether a message is answered at all, and it
 * has three behaviours that are easy to get backwards and impossible to spot
 * by eye:
 *
 * 1. **An unreadable count blocks.** Not knowing how many messages have gone
 *    out is not evidence that there is room left. This is the one that costs
 *    money if it is inverted, and inverting it is a one-word change.
 * 2. **A stale count does not block.** A real number from four minutes ago
 *    plus everything seen since is far better than no cap, so the cache keeps
 *    being used when a refresh fails.
 * 3. **The local count climbs between refreshes.** Without that, a burst of
 *    messages all read the same cached number and every one of them is
 *    answered, which is how a cap gets passed by fifty messages while showing
 *    199 used.
 */

import {
  checkMessageAllowance,
  noteMessageAccepted,
  resetUsageCache,
} from "../src/lib/usage-cap";

let failures = 0;
let total = 0;

function check(label: string, ok: boolean, note = "") {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(58)} ${note}`);
}

// --- stubs -----------------------------------------------------------------

const realFetch = globalThis.fetch;
const realNow = Date.now;

/** What the app's `usage` action would answer, or null to fail the call. */
let reply: { used: number; limit: number } | null = null;
/** Set to make the HTTP call itself fail rather than answer. */
let httpFails = false;
let calls = 0;

globalThis.fetch = (async () => {
  calls++;
  if (httpFails) throw new Error("connection refused");
  if (!reply) return { ok: false, status: 503 } as Response;
  const { used, limit } = reply;
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        blocked: used >= limit,
        resetsAt: "2026-10-01T00:00:00.000Z",
        resetsOn: "1 October",
      },
    }),
  } as unknown as Response;
}) as typeof fetch;

let clock = new Date("2026-09-15T09:00:00Z").getTime();
Date.now = () => clock;
const advanceMinutes = (n: number) => {
  clock += n * 60 * 1000;
};

// --- 1. the ordinary case --------------------------------------------------

resetUsageCache();
reply = { used: 40, limit: 200 };
let allowance = await checkMessageAllowance();
check(
  "under the cap the message is allowed",
  !allowance.blocked && allowance.known,
  `${allowance.used}/${allowance.limit}`,
);

// --- 2. at the cap ---------------------------------------------------------

resetUsageCache();
reply = { used: 200, limit: 200 };
allowance = await checkMessageAllowance();
check(
  "at 200 the message is blocked",
  allowance.blocked && allowance.known,
  `${allowance.used}/${allowance.limit}`,
);

resetUsageCache();
reply = { used: 199, limit: 200 };
allowance = await checkMessageAllowance();
check("at 199 it is not", !allowance.blocked, `${allowance.used}/${allowance.limit}`);

// --- 3. fails closed -------------------------------------------------------

// Never read successfully and cannot now: refuse. The `known` flag is how the
// handler tells this apart from a real cap in its log — reporting "cap
// reached (0/0)" during an outage would have an operator believing the client
// had spent their month.
resetUsageCache();
httpFails = true;
allowance = await checkMessageAllowance();
check(
  "an unreachable app blocks rather than waving it through",
  allowance.blocked && !allowance.known,
  `blocked=${allowance.blocked} known=${allowance.known}`,
);

resetUsageCache();
httpFails = false;
reply = null; // a non-200 answer
allowance = await checkMessageAllowance();
check(
  "and so does an error response",
  allowance.blocked && !allowance.known,
  `blocked=${allowance.blocked} known=${allowance.known}`,
);

// --- 4. a stale count still answers ---------------------------------------

resetUsageCache();
httpFails = false;
reply = { used: 10, limit: 200 };
await checkMessageAllowance(); // caches a real number
httpFails = true; // the app goes away
advanceMinutes(10); // and the cache goes stale
const before = calls;
allowance = await checkMessageAllowance();
check(
  "a stale count keeps answering instead of muting the assistant",
  !allowance.blocked && allowance.known,
  `${allowance.used}/${allowance.limit}, refresh attempted: ${calls > before}`,
);

// --- 5. the local count climbs between refreshes --------------------------

// The one that matters for a burst. Without it, fifty messages arriving in the
// same three-minute window all see the same cached number and all get
// answered.
resetUsageCache();
httpFails = false;
reply = { used: 198, limit: 200 };
allowance = await checkMessageAllowance();
check("198 of 200 is allowed", !allowance.blocked, `${allowance.used}`);

noteMessageAccepted();
allowance = await checkMessageAllowance();
check(
  "the next message counts itself without asking the app again",
  !allowance.blocked && allowance.used === 199,
  `${allowance.used}`,
);

noteMessageAccepted();
const callsBeforeCap = calls;
allowance = await checkMessageAllowance();
check(
  "and the one after that is blocked, with no refresh in between",
  allowance.blocked && allowance.used === 200 && calls === callsBeforeCap,
  `${allowance.used}/${allowance.limit}`,
);

// Erring high is the right direction: it stops a few messages early rather
// than letting a burst run past the cap.
noteMessageAccepted();
noteMessageAccepted();
allowance = await checkMessageAllowance();
check(
  "an overshoot stays blocked and reads 0 left",
  allowance.blocked && allowance.remaining === 0,
  `${allowance.used}/${allowance.limit}`,
);

// --- done ------------------------------------------------------------------

globalThis.fetch = realFetch;
Date.now = realNow;

console.log(
  failures === 0
    ? `\n${total} checks, 0 failed. Past the cap, and past a broken app, it says nothing.`
    : `\n${failures} of ${total} check(s) failed`,
);
process.exit(failures ? 1 : 0);
