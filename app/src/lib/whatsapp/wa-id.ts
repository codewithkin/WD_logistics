/**
 * Translating between the number a person types and the id WhatsApp uses.
 *
 * whatsapp-web.js addresses an individual chat as `<digits>@c.us` — no plus,
 * no spaces, country code included. We store E.164 (`+263772958986`) because
 * that is what a person recognises and what every other part of the system
 * uses. These two functions are the only place the two forms meet, so a
 * mismatch cannot creep in from a hand-rolled `.replace()` somewhere.
 *
 * Getting this wrong is quiet: a contact saved as `0772958986` simply never
 * matches an inbound `263772958986@c.us`, and the sender is told they are not
 * on the list.
 */

/** Group chats end in @g.us, individuals in @c.us. */
const INDIVIDUAL_SUFFIX = "@c.us";
const GROUP_SUFFIX = "@g.us";

/** "+263772958986" -> "263772958986@c.us" */
export function toWhatsAppId(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  return digits.length > 0 ? `${digits}${INDIVIDUAL_SUFFIX}` : null;
}

/**
 * "263772958986@c.us" -> "+263772958986"
 *
 * Handles the multi-device form too. WhatsApp addresses a specific linked
 * device as `263772958986:12@c.us`, and naively stripping non-digits turns
 * that into +26377295898612 — a number that matches no contact, so the sender
 * is told they are not on the list while the admin is certain the number is
 * right. The device index is everything after the colon and is dropped.
 *
 * Returns null for a group id: the assistant answers people, not groups, and
 * treating a group as a person would message everybody in it.
 */
export function fromWhatsAppId(waId: string | null | undefined): string | null {
  if (!waId) return null;
  if (waId.endsWith(GROUP_SUFFIX)) return null;

  const beforeSuffix = waId.split("@")[0] ?? "";
  const withoutDevice = beforeSuffix.split(":")[0] ?? "";
  const digits = withoutDevice.replace(/\D/g, "");
  return digits.length > 0 ? `+${digits}` : null;
}

/** True when this id addresses a group rather than one person. */
export function isGroupId(waId: string | null | undefined): boolean {
  return Boolean(waId?.endsWith(GROUP_SUFFIX));
}
