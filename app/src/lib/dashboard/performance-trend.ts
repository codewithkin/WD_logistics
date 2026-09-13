/**
 * Monthly Performance Trend API Route
 *
 * Fetches multi-metric monthly data for trend analysis:
 * - Revenue
 * - Trip count
 * - Expenses
 */

import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval } from "date-fns";

export interface MonthlyPerformanceTrend {
  month: string;
  date: Date;
  revenue: number;
  tripCount: number;
  expenses: number;
}

/**
 * Get performance trend for the specified period
 * @param organizationId The organization to scope queries to
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getPerformanceTrendData(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<MonthlyPerformanceTrend[]> {
  const now = new Date();
  const endDate = toDate || now;
  const startDate = fromDate || subMonths(now, 11);

  const [completedTrips, allTrips, expenses] = await Promise.all([
    prisma.trip.findMany({
      where: {
        organizationId: organizationId,
        status: "completed",
        endDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        revenue: true,
        endDate: true,
      },
    }),
    prisma.trip.findMany({
      where: {
        organizationId: organizationId,
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        scheduledDate: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        organizationId: organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        date: true,
      },
    }),
  ]);

  // Get all months in the range
  const monthIntervals = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: endOfMonth(endDate),
  });

  const inMonth = (date: Date, monthStart: Date, monthEnd: Date) =>
    new Date(date) >= monthStart && new Date(date) <= monthEnd;

  return monthIntervals.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);

    const revenue = completedTrips
      .filter((t) => t.endDate && inMonth(t.endDate, monthStart, monthEnd))
      .reduce((sum, t) => sum + (t.revenue || 0), 0);

    const tripCount = allTrips.filter((t) => inMonth(t.scheduledDate, monthStart, monthEnd)).length;

    const totalExpenses = expenses
      .filter((e) => inMonth(e.date, monthStart, monthEnd))
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      month: format(monthStart, "MMM"),
      date: monthStart,
      revenue: Math.round(revenue * 100) / 100,
      tripCount,
      expenses: Math.round(totalExpenses * 100) / 100,
    };
  });
}