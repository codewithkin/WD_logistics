/**
 * Monthly revenue vs expenses for the dashboard chart.
 *
 * Revenue here used to be customer *payments* while the stat card above the
 * chart and the trend chart below it both used completed-trip revenue, so the
 * same screen showed three different totals. Everything now comes from
 * @/lib/metrics/revenue — see that file for why "earned revenue" is the
 * measure that belongs next to expenses.
 */

import { getMonthlyPerformance } from "@/lib/metrics/revenue";
import { subMonths } from "date-fns";

export interface MonthlyRevenueExpense {
  month: string;
  date: Date;
  revenue: number;
  expenses: number;
}

/**
 * @param organizationId The organization to scope queries to
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getRevenueExpensesData(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<MonthlyRevenueExpense[]> {
  const now = new Date();
  const buckets = await getMonthlyPerformance(
    organizationId,
    fromDate || subMonths(now, 11),
    toDate || now,
  );

  return buckets.map(({ month, date, revenue, expenses }) => ({
    month,
    date,
    revenue,
    expenses,
  }));
}
