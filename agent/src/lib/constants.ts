/**
 * Application Constants
 * 
 * Centralized configuration for authorized WhatsApp access.
 */

/**
 * Get environment variables with logging for debugging
 */
function loadAuthNumbers() {
  const admin = process.env.ADMIN_WHATSAPP_NUMBER || "";
  const dev1 = process.env.WHATSAPP_DEVELOPER_NUMBER_ONE || "";
  const dev2 = process.env.WHATSAPP_DEVELOPER_NUMBER_TWO || "";
  
  console.log("📱 Loading authorized WhatsApp numbers:");
  console.log(`  - ADMIN_WHATSAPP_NUMBER: ${admin ? "✅ loaded" : "❌ missing"}`);
  console.log(`  - DEVELOPER_NUMBER_ONE: ${dev1 ? "✅ loaded" : "❌ missing"}`);
  console.log(`  - DEVELOPER_NUMBER_TWO: ${dev2 ? "✅ loaded" : "❌ missing"}`);
  
  return { admin, dev1, dev2 };
}

const { admin: ADMIN_WHATSAPP_NUMBER, dev1: DEVELOPER_NUMBER_ONE, dev2: DEVELOPER_NUMBER_TWO } = loadAuthNumbers();

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
 * Get all authorized phone numbers (excluding bot number)
 */
export function getAuthorizedNumbers(): string[] {
  return [
    ADMIN_WHATSAPP_NUMBER,
    DEVELOPER_NUMBER_ONE,
    DEVELOPER_NUMBER_TWO,
  ].filter(num => num && num.length > 5); // Filter out empty or invalid numbers
}

/**
 * Check if a phone number is authorized to use the AI assistant
 * Includes: admin number, developer numbers, and bot's own number
 */
export function isAuthorizedNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Check if it's the bot's own number
  if (BOT_PHONE_NUMBER && normalizePhoneNumber(BOT_PHONE_NUMBER) === normalized) {
    return true;
  }
  
  // Check against authorized numbers
  const authorizedNumbers = getAuthorizedNumbers();
  return authorizedNumbers.some(
    (authNumber) => normalizePhoneNumber(authNumber) === normalized
  );
}

/**
 * Get the name/title of an authorized user based on their phone number
 * Used for personalized greetings and references
 */
export function getAuthorizedUserName(phoneNumber: string): string | null {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Check if it's the admin
  if (ADMIN_WHATSAPP_NUMBER && normalizePhoneNumber(ADMIN_WHATSAPP_NUMBER) === normalized) {
    return "Mr Dziruni";
  }
  
  // Check if it's one of the developers
  if (
    (DEVELOPER_NUMBER_ONE && normalizePhoneNumber(DEVELOPER_NUMBER_ONE) === normalized) ||
    (DEVELOPER_NUMBER_TWO && normalizePhoneNumber(DEVELOPER_NUMBER_TWO) === normalized)
  ) {
    return "Kin";
  }
  
  // Check if it's the bot's own number
  if (BOT_PHONE_NUMBER && normalizePhoneNumber(BOT_PHONE_NUMBER) === normalized) {
    return "Bot";
  }
  
  return null;
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
  // Remove all non-digit characters except leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");
  
  // Remove leading + for comparison
  return cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
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
