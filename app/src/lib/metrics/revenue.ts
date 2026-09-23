/**
 * One definition of revenue for the whole app.
 *
 * Before this module the dashboard alone showed three different numbers under
 * the word "revenue" on one screen: a stat card summing completed trips, a
 * chart header summing customer payments, and a plotted line summing completed
 * trips again on a different date field. They never agreed, which is what made
 * the graphs impossible to trust.
 *
 * There are only two honest measures, and they answer different questions:
 *
 * - **Earned revenue** — what the fleet actually billed for work it finished in
 *   the period. Completed trips only, dated by when the trip ended (falling
 *   back to its scheduled date when a completed trip has no end date). This is
 *   the number that belongs next to expenses, because expenses are also "what
 *   happened in this period", and profit only means something when both sides
 *   are measured the same way.
 *
 * - **Cash collected** — payments received against invoices in the period. A
 *   cash-flow number, not a performance one: it moves when a customer settles
 *   an old invoice, which says nothing about how the fleet ran this month.
 *
 * Anything showing money over time picks one and says which. Never sum one and
 * plot the other.
 */

import prisma from "@/lib/prisma";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";

export interface MonthlyBucket {
  /** Always carries the year — "Jan" alone repeats across a 1y/all period. */
  month: string;
  date: Date;
  revenue: number;
  expenses: number;
  tripCount: number;
}

interface DatedAmount {
  date: Date;
  amount: number;
}

/**
 * Narrows a revenue figure to one customer, truck or driver. Combining them
 * is an AND — "this driver's revenue on that truck" is exactly what the
 * per-truck driver snapshots need.
 */
export interface RevenueScope {
  customerId?: string;
  truckId?: string;
  driverId?: string;
}

/**
 * Completed trips in a period, dated by `endDate` where there is one.
 *
 * A trip marked completed without an end date would otherwise vanish from every
 * revenue figure, so it falls back to its scheduled date.
 */
export function earnedRevenueWhere(
  organizationId: string,
  from: Date,
  to: Date,
  scope?: RevenueScope,
) {
  return {
    organizationId,
    status: "completed",
    ...(scope?.customerId ? { customerId: scope.customerId } : {}),
    ...(scope?.truckId ? { truckId: scope.truckId } : {}),
    ...(scope?.driverId ? { driverId: scope.driverId } : {}),
    OR: [
      { endDate: { gte: from, lte: to } },
      { endDate: null, scheduledDate: { gte: from, lte: to } },
    ],
  };
}

export async function getEarnedRevenue(
  organizationId: string,
  from: Date,
  to: Date,
  scope?: RevenueScope,
): Promise<number> {
  const trips = await prisma.trip.findMany({
    where: earnedRevenueWhere(organizationId, from, to, scope),
    select: { revenue: true },
  });

  return round(trips.reduce((sum, trip) => sum + (trip.revenue || 0), 0));
}

/** Payments received in the period — cash flow, not performance. */
export async function getCashCollected(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      invoice: { organizationId },
      paymentDate: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });

  return round(result._sum.amount || 0);
}

/**
 * Monthly earned revenue, expenses and trip count for one period.
 *
 * Every consumer derives its headline totals by summing these buckets rather
 * than running its own aggregate, so a chart's header and its plotted series
 * can't drift apart: the rows are fetched once, inside the period, and each one
 * lands in exactly one bucket.
 */
export async function getMonthlyPerformance(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<MonthlyBucket[]> {
  const [completedTrips, allTrips, expenses] = await Promise.all([
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: { revenue: true, endDate: true, scheduledDate: true },
    }),
    prisma.trip.findMany({
      where: {
        organizationId,
        scheduledDate: { gte: from, lte: to },
      },
      select: { scheduledDate: true },
    }),
    prisma.expense.findMany({
      where: {
        organizationId,
        date: { gte: from, lte: to },
      },
      select: { amount: true, date: true },
    }),
  ]);

  const revenueRows: DatedAmount[] = completedTrips.map((trip) => ({
    date: trip.endDate ?? trip.scheduledDate,
    amount: trip.revenue || 0,
  }));
  const expenseRows: DatedAmount[] = expenses.map((expense) => ({
    date: expense.date,
    amount: expense.amount,
  }));

  return bucketMonths(from, to, (monthStart, monthEnd) => ({
    revenue: sumIn(revenueRows, monthStart, monthEnd),
    expenses: sumIn(expenseRows, monthStart, monthEnd),
    tripCount: allTrips.filter((trip) =>
      within(trip.scheduledDate, monthStart, monthEnd),
    ).length,
  }));
}

/** Monthly cash collected, for anywhere that genuinely wants cash flow. */
export async function getMonthlyCashCollected(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<{ month: string; date: Date; cashCollected: number }[]> {
  const payments = await prisma.payment.findMany({
    where: {
      invoice: { organizationId },
      paymentDate: { gte: from, lte: to },
    },
    select: { amount: true, paymentDate: true },
  });

  const rows: DatedAmount[] = payments.map((p) => ({
    date: p.paymentDate,
    amount: p.amount,
  }));

  return monthsIn(from, to).map((monthStart) => ({
    month: format(monthStart, "MMM yyyy"),
    date: monthStart,
    cashCollected: sumIn(rows, monthStart, endOfMonth(monthStart)),
  }));
}

function monthsIn(from: Date, to: Date): Date[] {
  return eachMonthOfInterval({ start: startOfMonth(from), end: endOfMonth(to) });
}

function bucketMonths(
  from: Date,
  to: Date,
  build: (
    monthStart: Date,
    monthEnd: Date,
  ) => { revenue: number; expenses: number; tripCount: number },
): MonthlyBucket[] {
  return monthsIn(from, to).map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    return {
      month: format(monthStart, "MMM yyyy"),
      date: monthStart,
      ...build(monthStart, monthEnd),
    };
  });
}

function within(date: Date, from: Date, to: Date): boolean {
  const value = new Date(date);
  return value >= from && value <= to;
}

function sumIn(rows: DatedAmount[], from: Date, to: Date): number {
  return round(
    rows
      .filter((row) => within(row.date, from, to))
      .reduce((sum, row) => sum + row.amount, 0),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
