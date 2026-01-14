"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { notifySupplierCreated, notifySupplierUpdated, notifySupplierDeleted } from "@/lib/notifications";

export async function createSupplier(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  taxId?: string;
  paymentTerms?: number;
  notes?: string;
  status?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        status: data.status ?? "active",
        organizationId: session.organizationId,
      },
    });

    // Send admin notification
    notifySupplierCreated(
      {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        status: supplier.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/suppliers");
    return { success: true, supplier };
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return { success: false, error: "Failed to create supplier" };
  }
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    taxId?: string;
    paymentTerms?: number;
    notes?: string;
    status?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data,
    });

    // Send admin notification
    notifySupplierUpdated(
      {
        id: updatedSupplier.id,
        name: updatedSupplier.name,
        contactPerson: updatedSupplier.contactPerson,
        email: updatedSupplier.email,
        phone: updatedSupplier.phone,
        status: updatedSupplier.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { success: true, supplier: updatedSupplier };
  } catch (error) {
    console.error("Failed to update supplier:", error);
    return { success: false, error: "Failed to update supplier" };
  }
}

export async function deleteSupplier(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: { select: { expenses: true } },
      },
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    if (supplier._count.expenses > 0) {
      return {
        success: false,
        error: "Cannot delete supplier with associated expenses",
      };
    }

    await prisma.supplier.delete({ where: { id } });

    // Send admin notification
    notifySupplierDeleted(
      supplier.name,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/suppliers");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return { success: false, error: "Failed to delete supplier" };
  }
}

export async function updateSupplierBalance(id: string, amount: number) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        balance: supplier.balance + amount,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { success: true, supplier: updatedSupplier };
  } catch (error) {
    console.error("Failed to update supplier balance:", error);
    return { success: false, error: "Failed to update supplier balance" };
  }
}

export async function markExpenseAsPaid(expenseId: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId: session.organizationId },
      include: { supplier: true },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    if (expense.isPaid) {
      return { success: false, error: "Expense is already paid" };
    }

    // Update expense as paid
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        isPaid: true,
        paidDate: new Date(),
      },
    });

    // Update supplier balance if expense is tied to a supplier
    if (expense.supplierId) {
      await prisma.supplier.update({
        where: { id: expense.supplierId },
        data: {
          balance: {
            decrement: expense.amount,
          },
        },
      });
    }

    revalidatePath("/suppliers");
    revalidatePath("/finance/expenses");
    revalidatePath("/operations/expenses");
    if (expense.supplierId) {
      revalidatePath(`/suppliers/${expense.supplierId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to mark expense as paid:", error);
    return { success: false, error: "Failed to mark expense as paid" };
  }
}

export async function getSupplierOwingReport(supplierId?: string) {
  const session = await requireAuth();

  try {
    const whereClause = supplierId
      ? { organizationId: session.organizationId, id: supplierId }
      : { organizationId: session.organizationId };

    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      include: {
        expenses: {
          where: { isBusinessExpense: true },
          include: { category: true },
          orderBy: { date: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate owing for each supplier
    const suppliersWithOwing = suppliers.map((supplier) => {
      const unpaidExpenses = supplier.expenses.filter((e) => !e.isPaid);
      const paidExpenses = supplier.expenses.filter((e) => e.isPaid);
      const totalOwing = unpaidExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        ...supplier,
        unpaidExpenses,
        paidExpenses,
        totalOwing,
        totalPaid,
        totalExpenses: supplier.expenses.reduce((sum, e) => sum + e.amount, 0),
      };
    });

    const grandTotalOwing = suppliersWithOwing.reduce(
      (sum, s) => sum + s.totalOwing,
      0
    );

    return {
      success: true,
      suppliers: suppliersWithOwing,
      grandTotalOwing,
    };
  } catch (error) {
    console.error("Failed to get supplier owing report:", error);
    return { success: false, error: "Failed to get supplier owing report" };
  }
}
