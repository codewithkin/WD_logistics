import "server-only";

/**
 * Keeps secrets out of the stored transcript.
 *
 * Every exchange is written to `WhatsAppMessage` as an audit trail, and that
 * is the right default — except that setting a password means typing one into
 * a chat. Without this, "set Rudo's password to Harare2026" is stored in
 * plain text forever, and so is the generated password in the tool result.
 *
 * What this cannot do is worth being honest about: the message already
 * travelled through WhatsApp and is still sitting in the sender's own chat
 * history on their phone. This only stops the copy *we* keep. Telling the
 * person to delete the message is part of the reply for exactly that reason,
 * and `reset_user_password` — which emails the password instead — is the
 * safer route the model is told to prefer.
 */

const REPLACEMENT = "[redacted]";

/** Argument and result keys whose value is a secret, whatever it looks like. */
const SECRET_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "temporarypassword",
  "oldpassword",
  "confirmpassword",
  "token",
  "secret",
  "apikey",
]);

/**
 * Phrasings that carry a password in the message body.
 *
 * Deliberately greedy about what follows: a password can contain anything, so
 * everything to the end of the phrase goes rather than trying to guess where
 * it stops.
 */
const BODY_PATTERNS: RegExp[] = [
  // "password to Harare2026", "password as Harare2026", "password: Harare2026"
  /((?:new\s+|current\s+|old\s+)?password\s*(?:to|as|is|=|:)\s*)(\S.*)$/gim,
  // "set it to Harare2026" following the word password earlier in the line
  /(password[^\n]*?\bset\s+it\s+to\s+)(\S+)/gim,
  // "change my password Harare2026 Harare2027"
  /(\bpassword\s+)([^\s,.]{8,})/gim,
];

/** Strips anything password-shaped out of a message body. */
export function redactMessageBody(body: string): string {
  let out = body;
  for (const pattern of BODY_PATTERNS) {
    out = out.replace(pattern, (_match, lead: string) => `${lead}${REPLACEMENT}`);
  }
  return out;
}

/**
 * Strips secret values out of anything being stored as JSON — tool call
 * arguments and their results.
 */
export function redactValue(value: unknown, depth = 0): unknown {
  // A transcript payload is shallow; the bound stops a cycle from hanging.
  if (depth > 6) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.has(key.toLowerCase().replace(/[_-]/g, ""))
        ? REPLACEMENT
        : redactValue(inner, depth + 1);
    }
    return out;
  }

  return value;
}

/** True when the exchange touched a password at all, for the audit trail. */
export function mentionsSecret(body: string, payload: unknown): boolean {
  if (/password|passcode|credentials/i.test(body)) return true;
  const json = JSON.stringify(payload ?? "");
  return /"(?:new|current|old|temporary)?password"/i.test(json);
}
