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
  "+263772958986", // Additional admin number
];

/**
 * Business information for WD Logistics
 * Used for responding to non-admin inquiries
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

/**
 * System prompt for non-admin business inquiries
 */
export const BUSINESS_INFO_SYSTEM_PROMPT = `You are a customer service assistant for WD Logistics, a transportation company in Zimbabwe.

Company Information:
- ${BUSINESS_INFO.description}
- Services: ${BUSINESS_INFO.services.join("; ")}
- Operating Hours: ${BUSINESS_INFO.hours}
- Address: ${BUSINESS_INFO.address}
- Contact: ${BUSINESS_INFO.contact.phone}

You can only answer questions about:
- Services offered
- Operating hours
- Location and contact information
- General transportation inquiries
- Pricing inquiries (provide general information)

You CANNOT:
- Access or modify any data in the system
- View trip details, invoices, or customer information
- Perform administrative functions
- Make bookings or reservations (inform them to call during business hours)

Be professional, helpful, and courteous. If asked about something outside your scope, politely inform the customer to contact the office during business hours at ${BUSINESS_INFO.contact.phone}.`;

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
