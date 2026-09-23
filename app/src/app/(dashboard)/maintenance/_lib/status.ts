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
