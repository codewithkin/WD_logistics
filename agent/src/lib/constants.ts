/**
 * Application Constants
 * 
 * Centralized configuration for admin access and other settings.
 */

/**
 * Admin phone numbers allowed to interact with the AI assistant via WhatsApp
 * These numbers bypass normal user restrictions and have full access to the AI agent.
 * 
 * Format: Include country code with + prefix (e.g., "+263789859332")
 */
export const ADMIN_PHONE_NUMBERS: string[] = [
  "+263789859332",
];

/**
 * Check if a phone number is an admin number
 * Normalizes phone numbers before comparison for flexibility
 */
export function isAdminPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);
  return ADMIN_PHONE_NUMBERS.some(
    (adminNumber) => normalizePhoneNumber(adminNumber) === normalized
  );
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
