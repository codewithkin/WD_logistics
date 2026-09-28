/**
 * The fair-use cap, as the agent sees it.
 *
 * The app owns the count (`lib/assistant/usage.ts`) — it has the database and
 * it decides what a message is. This is the half that has to be fast: the
 * check runs on every inbound WhatsApp message, before the voice note is
 * transcribed and before any model is called, so it cannot afford an HTTP
 * round trip each time.
 *
 * So the count is held in memory, incremented locally as messages arrive, and
 * re-read from the app every few minutes. Between refreshes the local number
 * can only be too high, never too low: it counts everything this process has
 * seen since the last read. Erring high is the right direction — it stops a
 * few messages early rather than letting a burst run past the cap.
 */

const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";

/** How long a fetched count is trusted before it is read again. */
const REFRESH_AFTER_MS = 3 * 60 * 1000;

export interface MessageUsage {
  used: number;
  limit: number;
  remaining: number;
  blocked: boolean;
  resetsAt: string;
  resetsOn: string;
}

interface CachedUsage {
  usage: MessageUsage;
  fetchedAt: number;
  /** Messages counted locally since that fetch. */
  seenSince: number;
}

let cache: CachedUsage | null = null;

/** Drops the cached count — used by the checks, and after a failed read. */
export function resetUsageCache(): void {
  cache = null;
}

async function fetchUsage(): Promise<MessageUsage | null> {
  try {
    const response = await fetch(`${WEB_APP_URL}/api/agent/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AGENT_API_KEY,
        "x-organization-id": process.env.AGENT_ORGANIZATION_ID || "unknown",
      },
      body: JSON.stringify({ action: "usage" }),
      // Short: this runs before every message, and a slow app must not hold
      // up a reply. A timeout falls through to the blocked-and-unknown case
      // below, so the timeout must be generous enough that an app merely
      // under load does not mute the assistant.
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as {
      success: boolean;
      data?: MessageUsage;
    };
    return result.success && result.data ? result.data : null;
  } catch {
    return null;
  }
}

function withLocalCount(cached: CachedUsage): MessageUsage {
  const used = cached.usage.used + cached.seenSince;
  return {
    ...cached.usage,
    used,
    remaining: Math.max(0, cached.usage.limit - used),
    blocked: used >= cached.usage.limit,
  };
}

/**
 * Whether this organisation may be answered right now, and the numbers behind
 * that decision.
 *
 * **If the count cannot be read at all, the message is blocked.** Not knowing
 * how many messages have gone out this month is not evidence that there is
 * room left, and an assistant that keeps answering while the count is
 * unreadable is exactly how a flat-fee month runs past its budget without
 * anyone seeing it.
 *
 * The cost of that choice is real and worth stating: if the app is down when
 * the agent starts, every message is dropped in silence until it comes back.
 * That is deliberate — the app is where the tools live, so a reply during an
 * outage would be "I can't reach the system" anyway, and saying nothing is
 * the same silence the cap itself uses.
 *
 * A *stale* cache is different: it is a real count from minutes ago plus
 * everything seen since, so it keeps being used rather than blocking.
 */
export async function checkMessageAllowance(): Promise<MessageUsage & { known: boolean }> {
  const now = Date.now();

  if (!cache || now - cache.fetchedAt > REFRESH_AFTER_MS) {
    const fresh = await fetchUsage();
    if (fresh) {
      cache = { usage: fresh, fetchedAt: now, seenSince: 0 };
    } else if (!cache) {
      // Never read successfully, and can't now. Block, and say the number
      // isn't known so the caller can log which of the two it was.
      return {
        used: 0,
        limit: 0,
        remaining: 0,
        blocked: true,
        resetsAt: new Date().toISOString(),
        resetsOn: "",
        known: false,
      };
    }
    // Otherwise: keep using the stale cache plus its local increments. A
    // cached count that is a few minutes old is far better than no cap.
  }

  return { ...withLocalCount(cache!), known: true };
}

/**
 * Records that one inbound message was accepted.
 *
 * Called after the allowance check passes, so the count climbs between
 * refreshes instead of letting a burst of messages all see the same number.
 */
export function noteMessageAccepted(): void {
  if (cache) cache.seenSince += 1;
}
