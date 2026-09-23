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
  const session = await assertRole(["admin", "supervisor"]);

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
