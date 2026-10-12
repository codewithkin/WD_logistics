"use server";

import { assertRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resolvePeriod, type PeriodInput } from "@/lib/period-range";
import { generateExpenseReportPDF } from "@/lib/reports/pdf-report-generator";
import {
  categoryExpenseWhere,
  type CategoryExpenseFilters,
} from "./_lib/category-detail";
export interface ExpenseCategoryFormData {
  name: string;
  description?: string;
  isTruck: boolean;
  isTrip: boolean;
  isDriver: boolean;
  color?: string;
  icon?: string;
  defaultAccountId?: string | null;
  /**
   * What kind of cost this is, independent of its name — see the schema.
   * Drives the fuel and downtime figures on the truck cost breakdown.
   */
  kind?: string | null;
}

/**
 * Which account a kind of spending normally comes out of.
 *
 * Cash for what a driver or a yard hand pays on the road, Bank for what the
 * office settles by transfer. The same mapping the standard categories are
 * seeded with — see lib/setup/standard-categories-data.ts.
 */
const ACCOUNT_BY_KIND: Record<string, "cash" | "bank"> = {
  fuel: "cash",
  tolls: "cash",
  permits: "cash",
  salaries: "cash",
  maintenance: "bank",
  tyres: "bank",
  insurance: "bank",
  other: "bank",
};

/**
 * The same guess from the category's name, for the ones with no `kind`.
 *
 * `kind` only arrived in September, so categories made before that — which is
 * most of a live system's — carry none, and mapping by kind alone put every
 * single one on Bank. Diesel bought on the road is not settled by the office.
 */
const CASH_BY_NAME = /fuel|diesel|petrol|toll|allowance|parking|loading|offload|border|per.?diem/i;

/**
 * Point every category that has no account at one.
 *
 * This exists because of a live bug, not for tidiness. An expense debits an
 * account **only** when its category names one — "categories with no default
 * account skip accounting entirely", as the expense action puts it — and the
 * categories this system shipped with named none. So the client recorded a
 * month of expenses and watched Cash, Bank and Petty Cash sit perfectly
 * still, which is exactly what they reported.
 *
 * Fixing it one category at a time through the edit dialog is nine or twelve
 * trips through a form to undo something that was never their doing, so this
 * does the lot by `kind`, and reports what it touched. Categories that already
 * name an account are left alone: a deliberate choice of Petty Cash over Cash
 * is not ours to overwrite.
 *
 * Categories with no `kind` are read by name first (diesel, tolls, allowances
 * and the like are paid out of a float, not by transfer), and anything still
 * unrecognised falls to Bank — the safer guess for an unlabelled cost, since
 * the office settles what nobody has classified. Either way an admin can
 * change any of them in the dialog afterwards.
 */
export async function assignDefaultAccountsToCategories() {
  const user = await assertRole(["admin"]);

  try {
    const [unwired, accounts] = await Promise.all([
      prisma.expenseCategory.findMany({
        where: { organizationId: user.organizationId, defaultAccountId: null },
        select: { id: true, name: true, kind: true },
      }),
      prisma.financialAccount.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, type: true },
      }),
    ]);

    if (unwired.length === 0) {
      return { success: true as const, updated: 0, message: "Every category already draws from an account." };
    }

    const accountIdByType = new Map(accounts.map((account) => [account.type, account.id]));
    if (accountIdByType.size === 0) {
      return {
        success: false as const,
        error:
          "There are no accounts yet. Open Finance → Accounts and record the opening balances first, then come back.",
      };
    }

    // Bank, then Cash, then whatever exists — so an organisation that only
    // created one account still gets wired up rather than refused.
    const fallback =
      accountIdByType.get("bank") ?? accountIdByType.get("cash") ?? accounts[0]!.id;

    let updated = 0;
    for (const category of unwired) {
      const wanted =
        ACCOUNT_BY_KIND[category.kind ?? ""] ??
        (CASH_BY_NAME.test(category.name) ? "cash" : "bank");
      const accountId = accountIdByType.get(wanted) ?? fallback;
      await prisma.expenseCategory.update({
        where: { id: category.id },
        data: { defaultAccountId: accountId },
      });
      updated += 1;
    }

    revalidatePath("/finance/expense-categories");
    revalidatePath("/finance/expenses");
    return {
      success: true as const,
      updated,
      message: `${updated} ${updated === 1 ? "category" : "categories"} now draw from an account. Expenses recorded from here on will move that balance.`,
    };
  } catch (error) {
    console.error("Failed to assign default accounts:", error);
    return { success: false as const, error: "Could not assign the accounts" };
  }
}

export async function createExpenseCategory(data: ExpenseCategoryFormData) {
  const user = await assertRole(["admin"]);

  // Check if category name already exists
  const existing = await prisma.expenseCategory.findUnique({
    where: {
      organizationId_name: {
        organizationId: user.organizationId,
        name: data.name,
      },
    },
  });

  if (existing) {
    throw new Error("A category with this name already exists");
  }

  await prisma.expenseCategory.create({
    data: {
      organizationId: user.organizationId,
      name: data.name,
      description: data.description,
      isTruck: data.isTruck,
      isTrip: data.isTrip,
      isDriver: data.isDriver,
      color: data.color,
      icon: data.icon,
      defaultAccountId: data.defaultAccountId || null,
      kind: data.kind || null,
    },
  });

  revalidatePath("/finance/expense-categories");
}

export async function updateExpenseCategory(id: string, data: ExpenseCategoryFormData) {
  const user = await assertRole(["admin"]);

  // Verify ownership
  const existing = await prisma.expenseCategory.findUnique({
    where: { id },
    select: { organizationId: true, name: true },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Category not found");
  }

  // Check if new name conflicts with another category
  if (data.name !== existing.name) {
    const nameExists = await prisma.expenseCategory.findUnique({
      where: {
        organizationId_name: {
          organizationId: user.organizationId,
          name: data.name,
        },
      },
    });

    if (nameExists) {
      throw new Error("A category with this name already exists");
    }
  }

  await prisma.expenseCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      isTruck: data.isTruck,
      isTrip: data.isTrip,
      isDriver: data.isDriver,
      color: data.color,
      icon: data.icon,
      defaultAccountId: data.defaultAccountId || null,
      kind: data.kind || null,
    },
  });

  revalidatePath("/finance/expense-categories");
}

export async function deleteExpenseCategory(id: string) {
  const user = await assertRole(["admin"]);

  // Verify ownership
  const existing = await prisma.expenseCategory.findUnique({
    where: { id },
    select: { organizationId: true, _count: { select: { expenses: true } } },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Category not found");
  }

  if (existing._count.expenses > 0) {
    throw new Error("Cannot delete category with existing expenses");
  }

  await prisma.expenseCategory.delete({
    where: { id },
  });

  revalidatePath("/finance/expense-categories");
}

/**
 * Export one category's expenses for the period and filters on screen.
 *
 * The screen and the file must agree, so this takes the same filter shape the
 * detail page reads out of the URL and runs the same query behind it.
 */
export async function exportCategoryExpensesPDF(input: {
  categoryId: string;
  period?: PeriodInput;
  filters?: CategoryExpenseFilters;
}) {
  const session = await assertRole(["admin"]);

  try {
    const range = resolvePeriod(input.period, "3m");

    const category = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, organizationId: session.organizationId },
      select: { name: true },
    });

    if (!category) {
      return { success: false as const, error: "Category not found." };
    }

    const expenses = await prisma.expense.findMany({
      where: categoryExpenseWhere(
        session.organizationId,
        input.categoryId,
        range,
        input.filters ?? {},
      ),
      orderBy: { date: "desc" },
      include: {
        supplier: { select: { name: true } },
        truckExpenses: { include: { truck: { select: { registrationNo: true } } } },
        tripExpenses: {
          include: {
            trip: { select: { originCity: true, destinationCity: true } },
          },
        },
      },
    });

    if (expenses.length === 0) {
      return {
        success: false as const,
        error: `No expenses in ${category.name} for ${range.label.toLowerCase()}.`,
      };
    }

    const pdfBytes = generateExpenseReportPDF({
      expenses: expenses.map((expense) => ({
        date: expense.date,
        category: category.name,
        // The category is already the subject of the report, so the
        // description carries what the money was actually spent on.
        description: [
          expense.description || expense.notes || "No description",
          expense.truckExpenses.map((te) => te.truck.registrationNo).join(", "),
          expense.tripExpenses
            .map((te) => `${te.trip.originCity}→${te.trip.destinationCity}`)
            .join(", "),
        ]
          .filter(Boolean)
          .join(" · "),
        amount: expense.amount,
        reference:
          expense.supplier?.name || expense.vendor || expense.reference || undefined,
      })),
      // The header prints the window that was asked for, not the span of the
      // rows that happened to match it.
      period: { startDate: range.from, endDate: range.to },
    });

    const slug = category.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

    return {
      success: true as const,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `${slug}-expenses-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export category expenses:", error);
    return { success: false as const, error: "Failed to generate the PDF." };
  }
}
