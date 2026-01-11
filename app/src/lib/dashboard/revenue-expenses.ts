/**
 * Revenue vs Expenses API Route
 * 
 * Fetches monthly revenue and expenses data for the past 12 months
 * for visualization in the dashboard chart.
 */

import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface MonthlyRevenueExpense {
  month: string;
  date: Date;
  revenue: number;
  expenses: number;
}

/**
 * Get revenue vs expenses for the past 12 months
 */
export async function getRevenueExpensesData(): Promise<MonthlyRevenueExpense[]> {
  const user = await requireRole(["admin", "supervisor"]);
  const organization = user.organizationId;

  // Get data for past 12 months
  const months: MonthlyRevenueExpense[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(monthStart);

    // Get revenue from invoices for this month
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
