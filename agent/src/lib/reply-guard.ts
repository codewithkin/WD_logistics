/**
 * A last line of defence against the assistant talking in circles.
 *
 * `message_create` fires for outgoing messages too, so any path that lets a
 * reply be read back as a question is a loop with no exit. One did: a reply
 * came back in, failed the caller check, and was answered with "I don't have
 * this number on my list" — itself an outgoing message, so it came back in
 * too. 122 copies of that sentence reached a real person before the service
 * was stopped by hand.
 *
 * The cause of that particular loop is fixed at the source (the handler now
 * ignores anything with `fromMe` set). This exists so that the *next* one —
 * a WhatsApp addressing change, a new event, a echoed send from somewhere
 * else — costs somebody two messages instead of a hundred and twenty two.
 *
 * Deliberately in memory and deliberately simple: it is a circuit breaker,
 * not a record of anything. Losing its state on restart is fine, because a
 * restart is already the point at which a human has intervened.
 */

/** Identical text to the same number is pointless twice in a row. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000;

/** No number should receive more than this many replies in a minute. */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 8;

/** Stop tracking numbers that have gone quiet, so this cannot grow forever. */
const FORGET_AFTER_MS = 30 * 60 * 1000;

interface Recipient {
  /** When each recent reply was sent, oldest first. */
  sentAt: number[];
  lastText: string;
  lastTextAt: number;
  /** Set once we start suppressing, so the reason is only logged once. */
  suppressing: boolean;
}

const recipients = new Map<string, Recipient>();

function sweep(now: number) {
  for (const [phone, entry] of recipients) {
    const lastActivity = Math.max(entry.lastTextAt, entry.sentAt.at(-1) ?? 0);
    if (now - lastActivity > FORGET_AFTER_MS) recipients.delete(phone);
  }
}

export interface ReplyDecision {
  send: boolean;
  /** Why it was held back, for the log. Absent when sending. */
  reason?: string;
}

/**
 * Decides whether to send this reply, and records it when the answer is yes.
 *
 * Call once per outgoing message, immediately before sending.
 */
export function allowReply(phone: string, text: string, now = Date.now()): ReplyDecision {
  sweep(now);

  const entry = recipients.get(phone) ?? {
    sentAt: [],
    lastText: "",
    lastTextAt: 0,
    suppressing: false,
  };

  // Drop anything outside the rate window before counting.
  entry.sentAt = entry.sentAt.filter((at) => now - at < RATE_WINDOW_MS);

  const repeated = text === entry.lastText && now - entry.lastTextAt < REPEAT_WINDOW_MS;
  const tooMany = entry.sentAt.length >= RATE_LIMIT;

  if (repeated || tooMany) {
    const reason = repeated
      ? `the same message was already sent to ${phone} in the last ${REPEAT_WINDOW_MS / 60000} minutes`
      : `${phone} has had ${entry.sentAt.length} replies in the last minute`;

    // Record the attempt so the window keeps sliding, but do not send.
    entry.suppressing = true;
    recipients.set(phone, entry);
    return { send: false, reason };
  }

  entry.sentAt.push(now);
  entry.lastText = text;
  entry.lastTextAt = now;
  entry.suppressing = false;
  recipients.set(phone, entry);

  return { send: true };
}

/** Test seam: forget everything. */
export function resetReplyGuard() {
  recipients.clear();
}
