/**
 * Monthly Performance Trend API Route
 * 
 * Fetches multi-metric monthly data for trend analysis:
 * - Revenue
 * - Trip count
 * - Expenses
 */

import { requireRole } from "@/lib/session";
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
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getPerformanceTrendData(
  fromDate?: Date,
  toDate?: Date
): Promise<MonthlyPerformanceTrend[]> {
  const user = await requireRole(["admin", "supervisor"]);
  const organization = user.organizationId;

  const now = new Date();
  const endDate = toDate || now;
  const startDate = fromDate || subMonths(now, 11);

  // Get all months in the range
  const monthIntervals = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: endOfMonth(endDate),
  });

  const months: MonthlyPerformanceTrend[] = [];

  for (const monthStart of monthIntervals) {
    const monthEnd = endOfMonth(monthStart);

    // Get revenue from completed trips
    const trips = await prisma.trip.findMany({
      where: {
        organizationId: organization,
        status: "completed",
        endDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        revenue: true,
      },
    });

    const revenue = trips.reduce((sum, t) => sum + (t.revenue || 0), 0);
    const tripCount = trips.length;

    // Get trip count (all statuses)
    const allTripsCount = await prisma.trip.count({
      where: {
        organizationId: organization,
        scheduledDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: {
        organizationId: organization,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        amount: true,
      },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    months.push({
      month: format(monthStart, "MMM"),
      date: monthStart,
      revenue: Math.round(revenue * 100) / 100,
      tripCount: allTripsCount,
      expenses: Math.round(totalExpenses * 100) / 100,
    });
  }

  return months;
}
