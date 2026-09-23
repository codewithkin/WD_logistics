/**
 * Shared maintenance constants.
 *
 * Deliberately NOT in actions.ts: a "use server" module may only export async
 * functions, so a plain const there makes every page importing it throw
 * "A 'use server' file can only export async functions".
 */

export type MaintenanceVehicleType = "truck" | "trailer";

/** A job is open work until it's fixed — used wherever workshop sees its list. */
export const UNFINISHED_STATUSES = ["open", "assigned", "in_progress"] as const;

/**
 * Start of today in Harare (UTC+2), as a UTC instant.
 *
 * The server runs in UTC, so "today" has to be pinned to the yard's clock or
 * a job logged after 22:00 lands on tomorrow's card — and the daily digest
 * goes out describing the wrong day.
 */
export function startOfDayInHarare(now: Date = new Date()): Date {
    const harare = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const midnightUtcOfHarareDay = Date.UTC(
        harare.getUTCFullYear(),
        harare.getUTCMonth(),
        harare.getUTCDate(),
    );
    return new Date(midnightUtcOfHarareDay - 2 * 60 * 60 * 1000);
}
