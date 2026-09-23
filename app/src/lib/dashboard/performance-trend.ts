/**
 * Monthly performance trend: revenue, expenses and trip count.
 *
 * Shares its numbers with the revenue-vs-expenses chart and the dashboard stat
 * cards through @/lib/metrics/revenue, so the two charts on the dashboard can
 * no longer show different revenue for the same period.
 */

import { getMonthlyPerformance } from "@/lib/metrics/revenue";
import { subMonths } from "date-fns";

export interface MonthlyPerformanceTrend {
  month: string;
  date: Date;
  revenue: number;
  tripCount: number;
  expenses: number;
}

/**
 * @param organizationId The organization to scope queries to
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getPerformanceTrendData(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<MonthlyPerformanceTrend[]> {
  const now = new Date();
  const buckets = await getMonthlyPerformance(
    organizationId,
    fromDate || subMonths(now, 11),
    toDate || now,
  );

  return buckets.map(({ month, date, revenue, expenses, tripCount }) => ({
    month,
    date,
    revenue,
    expenses,
    tripCount,
  }));
}
