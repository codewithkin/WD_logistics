/**
 * "Which vehicle is eating the workshop's time?" — the ranking behind the
 * maintenance-history filter on the maintenance screen and the history card on
 * a truck's page.
 *
 * Downtime is measured from the day a job was logged to the day it was closed;
 * a job still open counts up to today, because the vehicle is still out.
 */

export interface MaintenanceHistoryInput {
  id: string;
  date: Date;
  status: string;
  fixedAt: Date | null;
  truck: { id: string; registrationNo: string; make: string; model: string } | null;
  trailer: { id: string; registrationNo: string; make: string; model: string } | null;
}

export interface MaintenanceHistoryRow {
  vehicleId: string;
  vehicleType: "truck" | "trailer";
  registrationNo: string;
  description: string;
  total: number;
  open: number;
  fixed: number;
  downtimeDays: number;
  lastRequestDate: Date;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function downtimeDaysFor(
  request: { date: Date; fixedAt: Date | null },
  now: Date = new Date(),
): number {
  const end = request.fixedAt ?? now;
  const days = (end.getTime() - request.date.getTime()) / MS_PER_DAY;
  // A job logged and closed the same day is still a day off the road.
  return days <= 0 ? 0 : Math.round(days * 10) / 10;
}

export function buildMaintenanceHistory(
  requests: MaintenanceHistoryInput[],
  now: Date = new Date(),
): MaintenanceHistoryRow[] {
  const byVehicle = new Map<string, MaintenanceHistoryRow>();

  for (const request of requests) {
    const vehicle = request.truck ?? request.trailer;
    if (!vehicle) continue; // vehicle deleted — nothing to rank

    const vehicleType: "truck" | "trailer" = request.truck ? "truck" : "trailer";
    const key = `${vehicleType}:${vehicle.id}`;

    const row =
      byVehicle.get(key) ??
      ({
        vehicleId: vehicle.id,
        vehicleType,
        registrationNo: vehicle.registrationNo,
        description: `${vehicle.make} ${vehicle.model}`.trim(),
        total: 0,
        open: 0,
        fixed: 0,
        downtimeDays: 0,
        lastRequestDate: request.date,
      } satisfies MaintenanceHistoryRow);

    row.total += 1;
    if (request.status === "fixed") row.fixed += 1;
    else row.open += 1;
    row.downtimeDays += downtimeDaysFor(request, now);
    if (request.date > row.lastRequestDate) row.lastRequestDate = request.date;

    byVehicle.set(key, row);
  }

  return [...byVehicle.values()]
    .map((row) => ({ ...row, downtimeDays: Math.round(row.downtimeDays * 10) / 10 }))
    .sort((a, b) => b.total - a.total || b.downtimeDays - a.downtimeDays);
}
