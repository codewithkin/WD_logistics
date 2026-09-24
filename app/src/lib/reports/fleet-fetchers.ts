import "server-only";

/**
 * Data for the three fleet reports: what fuel is costing, what the workshop
 * is costing in time, and how the drivers compare.
 *
 * These deliberately re-derive nothing that `lib/metrics` already owns. Fuel
 * is identified by the expense category's `kind`, exactly as the truck cost
 * breakdown does it, and downtime uses the same "raised until fixed" rule —
 * so the fuel line in this report and the fuel line on a truck's page are the
 * same number by construction.
 */

import { prisma } from "@/lib/prisma";
import { earnedRevenueWhere } from "@/lib/metrics/revenue";

const round = (value: number) => Math.round(value * 100) / 100;
const share = (part: number, whole: number) =>
  whole === 0 ? 0 : round((part / whole) * 100);

/** Days a job kept a vehicle off the road; open jobs count up to now. */
function downtimeDays(date: Date, fixedAt: Date | null): number {
  const end = fixedAt ?? new Date();
  const days = (end.getTime() - date.getTime()) / 86_400_000;
  return days > 0 ? days : 0;
}

// ---------------------------------------------------------------------------
// Fuel

export interface FuelReportRow {
  registrationNo: string;
  make: string;
  model: string;
  trips: number;
  kilometres: number;
  fuelSpend: number;
  /** Null when the truck drove no recorded distance in the period. */
  fuelPerKm: number | null;
  revenue: number;
  /** Fuel as a percentage of what this truck earned. */
  fuelShareOfRevenue: number | null;
  shareOfFleetFuel: number;
}

export interface FuelReportData {
  from: Date;
  to: Date;
  totalFuel: number;
  totalKilometres: number;
  fleetFuelPerKm: number | null;
  totalRevenue: number;
  rows: FuelReportRow[];
  /** Fuel spend per month across the fleet. */
  monthly: Array<{ month: string; amount: number }>;
}

export async function fetchFuelReportData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<FuelReportData> {
  const [trucks, fuelLinks, trips] = await Promise.all([
    prisma.truck.findMany({
      where: { organizationId },
      select: { id: true, registrationNo: true, make: true, model: true },
      orderBy: { registrationNo: "asc" },
    }),
    // Fuel is whatever the admin tagged as fuel. Matching on the category
    // name instead would miss "Diesel" and catch "Oil change".
    prisma.truckExpense.findMany({
      where: {
        expense: {
          organizationId,
          date: { gte: from, lte: to },
          category: { kind: "fuel" },
        },
      },
      select: {
        truckId: true,
        expense: {
          select: { id: true, amount: true, date: true },
        },
      },
    }),
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: { truckId: true, revenue: true, actualMileage: true, estimatedMileage: true },
    }),
  ]);

  // A fuel cost booked against several trucks is split evenly between them,
  // the same rule the truck cost breakdown uses, so per-truck fuel adds up to
  // what the company actually spent.
  const splitCount = new Map<string, number>();
  for (const link of fuelLinks) {
    splitCount.set(
      link.expense.id,
      (splitCount.get(link.expense.id) ?? 0) + 1,
    );
  }

  const fuelByTruck = new Map<string, number>();
  const monthlyFuel = new Map<string, number>();
  for (const link of fuelLinks) {
    const attributed =
      link.expense.amount / (splitCount.get(link.expense.id) || 1);
    fuelByTruck.set(
      link.truckId,
      (fuelByTruck.get(link.truckId) ?? 0) + attributed,
    );
    const key = link.expense.date.toISOString().slice(0, 7);
    monthlyFuel.set(key, (monthlyFuel.get(key) ?? 0) + attributed);
  }

  const statsByTruck = new Map<
    string,
    { trips: number; km: number; revenue: number }
  >();
  for (const trip of trips) {
    if (!trip.truckId) continue;
    const row = statsByTruck.get(trip.truckId) ?? { trips: 0, km: 0, revenue: 0 };
    row.trips += 1;
    // Actual distance where it was recorded, the estimate otherwise — the
    // same fallback the cost-per-km figures use.
    row.km += trip.actualMileage ?? trip.estimatedMileage ?? 0;
    row.revenue += trip.revenue || 0;
    statsByTruck.set(trip.truckId, row);
  }

  const totalFuel = round(
    Array.from(fuelByTruck.values()).reduce((s, v) => s + v, 0),
  );

  const rows: FuelReportRow[] = trucks
    .map((truck) => {
      const stats = statsByTruck.get(truck.id) ?? { trips: 0, km: 0, revenue: 0 };
      const fuelSpend = round(fuelByTruck.get(truck.id) ?? 0);
      return {
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        trips: stats.trips,
        kilometres: round(stats.km),
        fuelSpend,
        fuelPerKm: stats.km > 0 ? round(fuelSpend / stats.km) : null,
        revenue: round(stats.revenue),
        fuelShareOfRevenue:
          stats.revenue > 0 ? share(fuelSpend, stats.revenue) : null,
        shareOfFleetFuel: share(fuelSpend, totalFuel),
      };
    })
    // A truck that burned no fuel and ran no trips is noise on this report.
    .filter((row) => row.fuelSpend > 0 || row.trips > 0)
    .sort((a, b) => b.fuelSpend - a.fuelSpend);

  const totalKilometres = round(rows.reduce((s, r) => s + r.kilometres, 0));

  return {
    from,
    to,
    totalFuel,
    totalKilometres,
    fleetFuelPerKm: totalKilometres > 0 ? round(totalFuel / totalKilometres) : null,
    totalRevenue: round(rows.reduce((s, r) => s + r.revenue, 0)),
    rows,
    monthly: Array.from(monthlyFuel.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => ({
        month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        }),
        amount: round(amount),
      })),
  };
}

// ---------------------------------------------------------------------------
// Maintenance and downtime

export interface MaintenanceReportRow {
  vehicle: string;
  kind: "Truck" | "Trailer";
  raised: number;
  fixed: number;
  stillOpen: number;
  downtimeDays: number;
  /** Mean days from raised to fixed, over jobs closed in the period. */
  averageFixDays: number | null;
  maintenanceSpend: number;
}

export interface MaintenanceReportData {
  from: Date;
  to: Date;
  raised: number;
  fixed: number;
  stillOpen: number;
  totalDowntimeDays: number;
  totalSpend: number;
  rows: MaintenanceReportRow[];
  /** Jobs still open at the end of the period, oldest first. */
  openJobs: Array<{
    vehicle: string;
    notes: string;
    raised: Date;
    ageDays: number;
    status: string;
    assignedTo: string | null;
  }>;
}

export async function fetchMaintenanceReportData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<MaintenanceReportData> {
  const [jobs, maintenanceExpenses] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      select: {
        notes: true,
        date: true,
        status: true,
        fixedAt: true,
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.truckExpense.findMany({
      where: {
        expense: {
          organizationId,
          date: { gte: from, lte: to },
          category: { kind: "maintenance" },
        },
      },
      select: {
        expense: { select: { id: true, amount: true } },
        truck: { select: { registrationNo: true } },
      },
    }),
  ]);

  const splitCount = new Map<string, number>();
  for (const link of maintenanceExpenses) {
    splitCount.set(link.expense.id, (splitCount.get(link.expense.id) ?? 0) + 1);
  }
  const spendByVehicle = new Map<string, number>();
  for (const link of maintenanceExpenses) {
    const key = link.truck.registrationNo;
    spendByVehicle.set(
      key,
      (spendByVehicle.get(key) ?? 0) +
        link.expense.amount / (splitCount.get(link.expense.id) || 1),
    );
  }

  const byVehicle = new Map<
    string,
    {
      kind: "Truck" | "Trailer";
      raised: number;
      fixed: number;
      stillOpen: number;
      downtime: number;
      fixDaysTotal: number;
      fixedCount: number;
    }
  >();
  const openJobs: MaintenanceReportData["openJobs"] = [];

  for (const job of jobs) {
    const vehicle =
      job.truck?.registrationNo ?? job.trailer?.registrationNo ?? "Unassigned";
    const kind: "Truck" | "Trailer" = job.truck ? "Truck" : "Trailer";

    const row = byVehicle.get(vehicle) ?? {
      kind,
      raised: 0,
      fixed: 0,
      stillOpen: 0,
      downtime: 0,
      fixDaysTotal: 0,
      fixedCount: 0,
    };
    row.raised += 1;
    row.downtime += downtimeDays(job.date, job.fixedAt);

    if (job.status === "fixed" && job.fixedAt) {
      row.fixed += 1;
      row.fixDaysTotal += downtimeDays(job.date, job.fixedAt);
      row.fixedCount += 1;
    } else {
      row.stillOpen += 1;
      openJobs.push({
        vehicle,
        notes: job.notes,
        raised: job.date,
        ageDays: Math.round(downtimeDays(job.date, null)),
        status: job.status,
        assignedTo: job.assignedTo?.name ?? null,
      });
    }

    byVehicle.set(vehicle, row);
  }

  const rows: MaintenanceReportRow[] = Array.from(byVehicle.entries())
    .map(([vehicle, row]) => ({
      vehicle,
      kind: row.kind,
      raised: row.raised,
      fixed: row.fixed,
      stillOpen: row.stillOpen,
      downtimeDays: round(row.downtime),
      averageFixDays:
        row.fixedCount > 0 ? round(row.fixDaysTotal / row.fixedCount) : null,
      maintenanceSpend: round(spendByVehicle.get(vehicle) ?? 0),
    }))
    .sort((a, b) => b.downtimeDays - a.downtimeDays);

  // A vehicle can cost money in the workshop without a job being raised in
  // this period; it still belongs on a maintenance report.
  for (const [vehicle, spend] of spendByVehicle) {
    if (!byVehicle.has(vehicle)) {
      rows.push({
        vehicle,
        kind: "Truck",
        raised: 0,
        fixed: 0,
        stillOpen: 0,
        downtimeDays: 0,
        averageFixDays: null,
        maintenanceSpend: round(spend),
      });
    }
  }

  return {
    from,
    to,
    raised: jobs.length,
    fixed: rows.reduce((s, r) => s + r.fixed, 0),
    stillOpen: rows.reduce((s, r) => s + r.stillOpen, 0),
    totalDowntimeDays: round(rows.reduce((s, r) => s + r.downtimeDays, 0)),
    totalSpend: round(rows.reduce((s, r) => s + r.maintenanceSpend, 0)),
    rows,
    openJobs: openJobs.sort((a, b) => b.ageDays - a.ageDays),
  };
}

// ---------------------------------------------------------------------------
// Driver performance

export interface DriverPerformanceRow {
  driver: string;
  licenseNumber: string | null;
  currentTruck: string | null;
  trips: number;
  kilometres: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  revenuePerTrip: number | null;
}

export interface DriverPerformanceReportData {
  from: Date;
  to: Date;
  rows: DriverPerformanceRow[];
  totals: {
    trips: number;
    kilometres: number;
    revenue: number;
    expenses: number;
    profit: number;
  };
}

export async function fetchDriverPerformanceReportData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<DriverPerformanceReportData> {
  const [drivers, trips, driverExpenseLinks] = await Promise.all([
    prisma.driver.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
        assignedTruck: { select: { registrationNo: true } },
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: {
        driverId: true,
        revenue: true,
        actualMileage: true,
        estimatedMileage: true,
      },
    }),
    prisma.driverExpense.findMany({
      where: {
        expense: { organizationId, date: { gte: from, lte: to } },
      },
      select: {
        driverId: true,
        expense: { select: { id: true, amount: true } },
      },
    }),
  ]);

  const splitCount = new Map<string, number>();
  for (const link of driverExpenseLinks) {
    splitCount.set(link.expense.id, (splitCount.get(link.expense.id) ?? 0) + 1);
  }
  const expenseByDriver = new Map<string, number>();
  for (const link of driverExpenseLinks) {
    expenseByDriver.set(
      link.driverId,
      (expenseByDriver.get(link.driverId) ?? 0) +
        link.expense.amount / (splitCount.get(link.expense.id) || 1),
    );
  }

  const statsByDriver = new Map<
    string,
    { trips: number; km: number; revenue: number }
  >();
  for (const trip of trips) {
    if (!trip.driverId) continue;
    const row = statsByDriver.get(trip.driverId) ?? {
      trips: 0,
      km: 0,
      revenue: 0,
    };
    row.trips += 1;
    row.km += trip.actualMileage ?? trip.estimatedMileage ?? 0;
    row.revenue += trip.revenue || 0;
    statsByDriver.set(trip.driverId, row);
  }

  const rows: DriverPerformanceRow[] = drivers
    .map((driver) => {
      const stats = statsByDriver.get(driver.id) ?? {
        trips: 0,
        km: 0,
        revenue: 0,
      };
      const revenue = round(stats.revenue);
      const expenses = round(expenseByDriver.get(driver.id) ?? 0);
      const profit = round(revenue - expenses);

      return {
        driver: `${driver.firstName} ${driver.lastName}`,
        licenseNumber: driver.licenseNumber,
        currentTruck: driver.assignedTruck?.registrationNo ?? null,
        trips: stats.trips,
        kilometres: round(stats.km),
        revenue,
        expenses,
        profit,
        margin: revenue > 0 ? share(profit, revenue) : null,
        revenuePerTrip: stats.trips > 0 ? round(revenue / stats.trips) : null,
      };
    })
    .filter((row) => row.trips > 0 || row.expenses > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    from,
    to,
    rows,
    totals: {
      trips: rows.reduce((s, r) => s + r.trips, 0),
      kilometres: round(rows.reduce((s, r) => s + r.kilometres, 0)),
      revenue: round(rows.reduce((s, r) => s + r.revenue, 0)),
      expenses: round(rows.reduce((s, r) => s + r.expenses, 0)),
      profit: round(rows.reduce((s, r) => s + r.profit, 0)),
    },
  };
}
