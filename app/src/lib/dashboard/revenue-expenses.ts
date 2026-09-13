/**
 * Revenue vs Expenses API Route
 *
 * Fetches monthly revenue and expenses data for the specified period
 * for visualization in the dashboard chart.
 */

import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval } from "date-fns";

export interface MonthlyRevenueExpense {
  month: string;
  date: Date;
  revenue: number;
  expenses: number;
}

/**
 * Get revenue vs expenses for the specified period
 * @param organizationId The organization to scope queries to
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getRevenueExpensesData(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<MonthlyRevenueExpense[]> {
  const now = new Date();
  const endDate = toDate || now;
  const startDate = fromDate || subMonths(now, 11);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        invoice: {
          organizationId: organizationId,
        },
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        paymentDate: true,
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

    const revenue = payments
      .filter((p) => inMonth(p.paymentDate, monthStart, monthEnd))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpenses = expenses
      .filter((e) => inMonth(e.date, monthStart, monthEnd))
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      month: format(monthStart, "MMM yyyy"),
      date: monthStart,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
    };
  });
}