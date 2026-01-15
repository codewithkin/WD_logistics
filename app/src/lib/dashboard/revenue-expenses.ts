/**
 * Revenue vs Expenses API Route
 * 
 * Fetches monthly revenue and expenses data for the specified period
 * for visualization in the dashboard chart.
 */

import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format, differenceInMonths, eachMonthOfInterval } from "date-fns";

export interface MonthlyRevenueExpense {
  month: string;
  date: Date;
  revenue: number;
  expenses: number;
}

/**
 * Get revenue vs expenses for the specified period
 * @param fromDate Start of the period (defaults to 12 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getRevenueExpensesData(
  fromDate?: Date,
  toDate?: Date
): Promise<MonthlyRevenueExpense[]> {
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

  const months: MonthlyRevenueExpense[] = [];

  for (const monthStart of monthIntervals) {
    const monthEnd = endOfMonth(monthStart);

    // Get revenue from payments for this month
    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          organizationId: organization,
        },
        paymentDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        amount: true,
      },
    });

    const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Get expenses for this month
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
      month: format(monthStart, "MMM yyyy"),
      date: monthStart,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
    });
  }

  return months;
}
