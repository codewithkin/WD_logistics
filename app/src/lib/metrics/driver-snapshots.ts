import "server-only";

/**
 * A driver's earnings, broken into one snapshot per truck they had.
 *
 * The client's own example: a driver runs ABC 222 from January to April and
 * generates $20k, switches to AAD 244 and generates $30k, then FEJ 3874 and
 * generates $71.8k. The driver page should total $121.8k for the year, and a
 * details page should show the three periods separately — "from this date to
 * this date they had this truck, they generated this, and these were their
 * costs". Their words: when a new truck starts, that snapshot begins at $0,
 * but the cumulative total carries on.
 *
 * Attribution, per the decision recorded in the plan: a snapshot includes the
 * trip revenue and trip costs for that driver on that truck, the driver's own
 * costs dated inside the window, and the truck's costs dated inside it — each
 * shown on its own line, so the reader can tell driver-caused spending from
 * truck-caused spending.
 *
 * Two things this gets deliberately right:
 *
 * **Trips are attributed by their own truck and driver**, not by the
 * assignment history. If the history is slightly off — a backdated switch, a
 * backfilled segment — the revenue still lands on the truck that actually ran
 * the trip.
 *
 * **Windows are clipped to the selected period** and the table says so, so a
 * 3-month view of a 6-month assignment shows three months of earnings rather
 * than six under a heading that says three.
 */

import { prisma } from "@/lib/prisma";
import { earnedRevenueWhere } from "@/lib/metrics/revenue";

export interface DriverSnapshot {
  assignmentId: string | null;
  truckId: string | null;
  registrationNo: string;
  /** The assignment's own dates. */
  startDate: Date;
  endDate: Date | null;
  /** The part of it inside the selected period. */
  clippedFrom: Date;
  clippedTo: Date;
  /** True when the window was cut by the period, so the UI can say so. */
  clipped: boolean;
  days: number;
  trips: number;
  revenue: number;
  tripExpenses: number;
  driverExpenses: number;
  truckExpenses: number;
  expenses: number;
  profit: number;
  margin: number | null;
}

export interface DriverPerformance {
  snapshots: DriverSnapshot[];
  /**
   * Trips and costs that fall outside any assignment window. Normally empty;
   * it exists so the cumulative total always reconciles with the snapshots
   * instead of quietly losing rows.
   */
  unassigned: {
    trips: number;
    revenue: number;
    expenses: number;
  };
  cumulative: {
    trips: number;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number | null;
  };
  /** The driver's truck right now, and since when. */
  current: { registrationNo: string; since: Date } | null;
}

interface Range {
  from: Date;
  to: Date;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Overlap of an assignment window with the selected period, or null. */
function clip(
  assignment: { startDate: Date; endDate: Date | null },
  range: Range,
): { from: Date; to: Date } | null {
  const start = assignment.startDate > range.from ? assignment.startDate : range.from;
  const end =
    assignment.endDate === null || assignment.endDate > range.to
      ? range.to
      : assignment.endDate;
  return start < end ? { from: start, to: end } : null;
}

export async function getDriverPerformance(
  organizationId: string,
  driverId: string,
  range: Range,
): Promise<DriverPerformance> {
  const [assignments, driver] = await Promise.all([
    prisma.driverTruckAssignment.findMany({
      where: {
        organizationId,
        driverId,
        // Any assignment that overlaps the period at all.
        startDate: { lte: range.to },
        OR: [{ endDate: null }, { endDate: { gte: range.from } }],
      },
      include: { truck: { select: { registrationNo: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        assignedTruckId: true,
        assignedTruck: { select: { registrationNo: true } },
      },
    }),
  ]);

  const snapshots: DriverSnapshot[] = [];
  const countedTripIds = new Set<string>();
  const countedExpenseIds = new Set<string>();

  for (const assignment of assignments) {
    const window = clip(assignment, range);
    if (!window) continue;

    const [trips, tripCosts, driverCosts, truckCosts] = await Promise.all([
      // Revenue and trip count, by the trip's own truck and driver — not by
      // the assignment, so a slightly-off history can't misattribute money.
      prisma.trip.findMany({
        where: {
          ...earnedRevenueWhere(organizationId, window.from, window.to, {
            driverId,
            truckId: assignment.truckId,
          }),
        },
        select: { id: true, revenue: true },
      }),
      prisma.expense.findMany({
        where: {
          organizationId,
          date: { gte: window.from, lte: window.to },
          tripExpenses: {
            some: { trip: { driverId, truckId: assignment.truckId } },
          },
        },
        select: { id: true, amount: true, tripExpenses: { select: { id: true } } },
      }),
      prisma.expense.findMany({
        where: {
          organizationId,
          date: { gte: window.from, lte: window.to },
          driverExpenses: { some: { driverId } },
        },
        select: { id: true, amount: true, driverExpenses: { select: { id: true } } },
      }),
      prisma.expense.findMany({
        where: {
          organizationId,
          date: { gte: window.from, lte: window.to },
          truckExpenses: { some: { truckId: assignment.truckId } },
        },
        select: { id: true, amount: true, truckExpenses: { select: { id: true } } },
      }),
    ]);

    for (const trip of trips) countedTripIds.add(trip.id);

    // A cost shared across several links is split, the same rule the truck
    // cost breakdown uses — otherwise the snapshots sum to more than was
    // actually spent.
    const sumSplit = (
      rows: Array<{ id: string; amount: number; [key: string]: unknown }>,
      linkKey: string,
    ) =>
      rows.reduce((total, row) => {
        countedExpenseIds.add(row.id);
        const links = (row[linkKey] as Array<unknown>).length || 1;
        return total + row.amount / links;
      }, 0);

    const tripExpenses = sumSplit(tripCosts, "tripExpenses");
    const driverExpenses = sumSplit(driverCosts, "driverExpenses");
    const truckExpenses = sumSplit(truckCosts, "truckExpenses");

    const revenue = trips.reduce((sum, trip) => sum + (trip.revenue || 0), 0);
    const expenses = tripExpenses + driverExpenses + truckExpenses;

    snapshots.push({
      assignmentId: assignment.id,
      truckId: assignment.truckId,
      registrationNo: assignment.truck.registrationNo,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      clippedFrom: window.from,
      clippedTo: window.to,
      // Clipped whenever the window shown is narrower than the assignment
      // actually is. An open assignment runs to today, so a period ending
      // before today cuts it too — the first version of this missed that and
      // showed a three-month slice of an ongoing assignment as if it were the
      // whole thing.
      clipped:
        window.from > assignment.startDate ||
        window.to < (assignment.endDate ?? new Date()),
      days: Math.max(
        1,
        Math.round(
          (window.to.getTime() - window.from.getTime()) / (1000 * 60 * 60 * 24),
        ),
      ),
      trips: trips.length,
      revenue: round(revenue),
      tripExpenses: round(tripExpenses),
      driverExpenses: round(driverExpenses),
      truckExpenses: round(truckExpenses),
      expenses: round(expenses),
      profit: round(revenue - expenses),
      margin: revenue > 0 ? round(((revenue - expenses) / revenue) * 100) : null,
    });
  }

  // ---- Anything the assignments didn't cover ----
  //
  // A trip run while the history says the driver had a different truck, or no
  // truck at all. This should normally be empty; it exists so the cumulative
  // total reconciles rather than silently dropping rows.
  const allTrips = await prisma.trip.findMany({
    where: earnedRevenueWhere(organizationId, range.from, range.to, { driverId }),
    select: { id: true, revenue: true },
  });
  const strayTrips = allTrips.filter((trip) => !countedTripIds.has(trip.id));

  const allDriverCosts = await prisma.expense.findMany({
    where: {
      organizationId,
      date: { gte: range.from, lte: range.to },
      driverExpenses: { some: { driverId } },
    },
    select: { id: true, amount: true, driverExpenses: { select: { id: true } } },
  });
  const strayCosts = allDriverCosts.filter(
    (expense) => !countedExpenseIds.has(expense.id),
  );

  const unassigned = {
    trips: strayTrips.length,
    revenue: round(strayTrips.reduce((sum, trip) => sum + (trip.revenue || 0), 0)),
    expenses: round(
      strayCosts.reduce(
        (sum, expense) =>
          sum + expense.amount / (expense.driverExpenses.length || 1),
        0,
      ),
    ),
  };

  const cumulativeRevenue =
    snapshots.reduce((sum, s) => sum + s.revenue, 0) + unassigned.revenue;
  const cumulativeExpenses =
    snapshots.reduce((sum, s) => sum + s.expenses, 0) + unassigned.expenses;
  const cumulativeTrips =
    snapshots.reduce((sum, s) => sum + s.trips, 0) + unassigned.trips;

  const openAssignment = assignments.find((a) => a.endDate === null);

  return {
    snapshots,
    unassigned,
    cumulative: {
      trips: cumulativeTrips,
      revenue: round(cumulativeRevenue),
      expenses: round(cumulativeExpenses),
      profit: round(cumulativeRevenue - cumulativeExpenses),
      margin:
        cumulativeRevenue > 0
          ? round(((cumulativeRevenue - cumulativeExpenses) / cumulativeRevenue) * 100)
          : null,
    },
    current:
      driver?.assignedTruck && openAssignment
        ? {
            registrationNo: driver.assignedTruck.registrationNo,
            since: openAssignment.startDate,
          }
        : null,
  };
}

/** The mirror view for a truck: every driver who has run it, with their figures. */
export async function getTruckDriverSnapshots(
  organizationId: string,
  truckId: string,
  range: Range,
): Promise<
  Array<{
    driverId: string;
    driverName: string;
    startDate: Date;
    endDate: Date | null;
    clippedFrom: Date;
    clippedTo: Date;
    trips: number;
    revenue: number;
  }>
> {
  const assignments = await prisma.driverTruckAssignment.findMany({
    where: {
      organizationId,
      truckId,
      startDate: { lte: range.to },
      OR: [{ endDate: null }, { endDate: { gte: range.from } }],
    },
    include: { driver: { select: { firstName: true, lastName: true } } },
    orderBy: { startDate: "desc" },
  });

  const rows = [];
  for (const assignment of assignments) {
    const window = clip(assignment, range);
    if (!window) continue;

    const trips = await prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, window.from, window.to, {
        truckId,
        driverId: assignment.driverId,
      }),
      select: { revenue: true },
    });

    rows.push({
      driverId: assignment.driverId,
      driverName: `${assignment.driver.firstName} ${assignment.driver.lastName}`,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      clippedFrom: window.from,
      clippedTo: window.to,
      trips: trips.length,
      revenue: round(trips.reduce((sum, trip) => sum + (trip.revenue || 0), 0)),
    });
  }

  return rows;
}
