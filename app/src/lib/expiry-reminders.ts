/**
 * Client-safe registry of every expiry date the app tracks, plus the reminder
 * rules shared by the forms and the document-expiry-reminders cron job.
 * Server-side reads/writes live in @/lib/expiry-reminders-server.
 */

export type ExpiryEntityType = "truck" | "trailer" | "driver";

export interface ExpiryFieldDefinition {
  field: string;
  label: string;
}

export const EXPIRY_FIELDS: Record<ExpiryEntityType, ExpiryFieldDefinition[]> = {
  truck: [
    { field: "crossBorderInsuranceExpiration", label: "Cross-Border Insurance" },
    { field: "crossBorderPermitExpiration", label: "Cross-Border Permit" },
    { field: "vehicleLicenseExpiration", label: "Vehicle License" },
    { field: "certificateOfFitnessExpiration", label: "Certificate of Fitness" },
  ],
  trailer: [{ field: "licenseExpiration", label: "Trailer License" }],
  driver: [
    { field: "licenseExpiration", label: "Driver's License" },
    { field: "passportExpiration", label: "Passport" },
    { field: "defenseCertificateExpiration", label: "Defense Certificate" },
    { field: "internationalDrivingPermitExpiration", label: "International Driving Permit (AA)" },
  ],
};

/** Used for any document that has no custom reminders configured. */
export const DEFAULT_REMINDER_DAYS = [30, 14, 7, 3, 1];

export const MAX_REMINDER_DAYS = 365;

/** Reminder days keyed by expiry field name, e.g. { vehicleLicenseExpiration: [30, 7] }. */
export type ReminderDays = Record<string, number[]>;

export function isValidReminderDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= MAX_REMINDER_DAYS;
}

/**
 * Whether a reminder is due today. Advance reminders follow the entity's own
 * configured days, or the default schedule when none are set; the expiry day
 * itself and every 7th day after lapsing always fire.
 */
export function shouldSendExpiryReminder(daysUntilExpiry: number, configuredDays: number[]): boolean {
  if (daysUntilExpiry === 0) return true;
  if (daysUntilExpiry < 0) return Math.abs(daysUntilExpiry) % 7 === 0;
  const schedule = configuredDays.length > 0 ? configuredDays : DEFAULT_REMINDER_DAYS;
  return schedule.includes(daysUntilExpiry);
}

/** De-duplicates, drops invalid values and sorts furthest-out first. */
export function normalizeReminderDays(days: number[]): number[] {
  return [...new Set(days.filter(isValidReminderDay))].sort((a, b) => b - a);
}
