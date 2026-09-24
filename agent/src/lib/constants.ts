/**
 * Constants for the WhatsApp session.
 *
 * This used to hold the allowlist too — three phone numbers read from
 * ADMIN_WHATSAPP_NUMBER and WHATSAPP_DEVELOPER_NUMBER_ONE/TWO, which meant a
 * redeploy to let a new supervisor message the bot. That list now lives in
 * the database as WhatsAppContact rows, managed under Settings, and the
 * assistant checks it on every message. The variables and the functions that
 * read them are gone rather than left to rot.
 */

// Store bot's own number (set at runtime after WhatsApp connects)
let BOT_PHONE_NUMBER: string | null = null;

/**
 * Set the bot's own phone number after WhatsApp connection
 */
export function setBotPhoneNumber(phoneNumber: string) {
  BOT_PHONE_NUMBER = phoneNumber;
  console.log(`✅ Bot phone number registered: ${phoneNumber}`);
}

/**
 * Get the bot's current phone number
 */
export function getBotPhoneNumber(): string | null {
  return BOT_PHONE_NUMBER;
}




/**
 * Format a phone number for WhatsApp (webjs format)
 * Converts from various formats to: 263789859332@c.us
 */
export function formatForWhatsApp(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, "");
  
  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }
  
  // Ensure it starts with country code (263 for Zimbabwe)
  if (cleaned.startsWith("0")) {
    cleaned = "263" + cleaned.slice(1);
  }
  
  // Return in WhatsApp format
  return `${cleaned}@c.us`;
}

/**
 * Extract phone number from WhatsApp ID
 * Converts from: 263789859332@c.us or @lid or @g.us
 * To: +263789859332
 */
export function extractPhoneNumber(whatsappId: string): string {
  // Extract just the number part
  const phoneNumber = whatsappId.replace(/@c\.us|@lid|@g\.us/g, "");
  // Add + prefix for international format
  return `+${phoneNumber}`;
}

/**
 * Check if a WhatsApp message should be ignored
 * Returns true for: broadcast messages, status updates, group messages
 */
export function shouldIgnoreMessage(whatsappFrom: string): boolean {
  return whatsappFrom.includes("@lid") || whatsappFrom.includes("@g.us");
}

/**
 * Normalize phone number for comparison
 * Removes all non-digit characters and ensures consistent format
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");
  
  return cleaned;
}

/**
 * Business information for WD Logistics
 * Used for basic company info queries (not currently used in authorized flow)
 */
export const BUSINESS_INFO = {
  name: "WD Logistics",
  description: "WD Logistics provide short and long distance transport to its clients from Zimbabwe and the SADC region.",
  services: [
    "All our vehicles are fully equipped with satellite tracking devices for real time tracking",
    "Drivers and vehicles are 100% Hazmat compliant",
    "Well maintained fleet, trained drivers ensures a competent and efficient service",
    "WD Logistics provides customers with courteous, prompt and dependable service"
  ],
  hours: "08:00 - 17:00",
  address: "5182 Tameside Close Nyakamete, Mutare, Zimbabwe",
  contact: {
    phone: "+263 77 295 8986",
  }
};
