"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { notifySupplierCreated, notifySupplierUpdated, notifySupplierDeleted } from "@/lib/notifications";
import { handleActionError } from "@/lib/error-messages";

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
    return { success: true as const, supplier };
  } catch (error) {
    return handleActionError(error, "Failed to create supplier");
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
  },
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "supplier",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!supplier) {
      return { success: false as const, error: "Supplier not found" };
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
    return { success: true as const, supplier: updatedSupplier };
  } catch (error) {
    return handleActionError(error, "Failed to update supplier");
  }
}

export async function deleteSupplier(id: string,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "supplier",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: { select: { expenses: true } },
      },
    });

    if (!supplier) {
      return { success: false as const, error: "Supplier not found" };
    }

    if (supplier._count.expenses > 0) {
      return {
        success: false as const,
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
    return { success: true as const };
  } catch (error) {
    return handleActionError(error, "Failed to delete supplier");
  }
}

export async function updateSupplierBalance(id: string, amount: number) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!supplier) {
      return { success: false as const, error: "Supplier not found" };
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        balance: supplier.balance + amount,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { success: true as const, supplier: updatedSupplier };
  } catch (error) {
    return handleActionError(error, "Failed to update supplier balance");
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
      return { success: false as const, error: "Expense not found" };
    }

    if (expense.isPaid) {
      return { success: false as const, error: "Expense is already paid" };
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
    return { success: true as const };
  } catch (error) {
    return handleActionError(error, "Failed to mark expense as paid");
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
      success: true as const,
      suppliers: suppliersWithOwing,
      grandTotalOwing,
    };
  } catch (error) {
    return handleActionError(error, "Failed to get supplier owing report");
  }
}
