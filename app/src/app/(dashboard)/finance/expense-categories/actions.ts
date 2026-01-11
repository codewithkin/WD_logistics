"use server";

import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ExpenseCategoryFormData {
  name: string;
  description?: string;
  isTruck: boolean;
  isTrip: boolean;
  color?: string;
  icon?: string;
}

export async function createExpenseCategory(data: ExpenseCategoryFormData) {
  const user = await requireRole(["admin", "supervisor"]);

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
      color: data.color,
      icon: data.icon,
    },
  });

  revalidatePath("/finance/expense-categories");
}

export async function updateExpenseCategory(id: string, data: ExpenseCategoryFormData) {
  const user = await requireRole(["admin", "supervisor"]);

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
      color: data.color,
      icon: data.icon,
    },
  });

  revalidatePath("/finance/expense-categories");
}

export async function deleteExpenseCategory(id: string) {
  const user = await requireRole(["admin", "supervisor"]);

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
