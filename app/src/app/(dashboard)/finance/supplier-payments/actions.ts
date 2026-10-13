"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { PaymentMethod } from "@/lib/types";
import {
    creditAccountForSupplierReversal,
    debitAccountForSupplierPayment,
} from "@/lib/accounts-server";

/**
 * A supplier's unsettled bills, for the "settles which bill?" choice.
 *
 * Only expenses still unpaid and not already claimed by another payment, so
 * nothing can be settled twice.
 */
export async function listOpenSupplierBills(supplierId: string) {
    const session = await requireRole(["admin", "supervisor"]);

    const bills = await prisma.expense.findMany({
        where: {
            organizationId: session.organizationId,
            supplierId,
            isPaid: false,
            supplierPayment: null,
        },
        select: {
            id: true,
            amount: true,
            date: true,
            description: true,
            notes: true,
            category: { select: { name: true } },
        },
        orderBy: { date: "asc" },
    });

    return bills.map((bill) => ({
        id: bill.id,
        amount: bill.amount,
        label: `${bill.date.toLocaleDateString("en-GB")} — ${
            bill.description || bill.notes || bill.category.name
        }`,
    }));
}

export async function createSupplierPayment(data: {
    supplierId: string;
    amount: number;
    paymentDate: Date;
    method: PaymentMethod;
    customMethod?: string;
    reference?: string;
    description?: string;
    notes?: string;
    /** Which account the money left. Null records the payment only. */
    accountId?: string | null;
    /**
     * The bill this payment settles, when it settles one in particular.
     *
     * Without it, recording a payment and then ticking the same bill as paid
     * on the supplier's page took the money off what they are owed twice.
     */
    expenseId?: string | null;
}) {
    const session = await requireRole(["admin", "supervisor"]);

    try {
        const supplier = await prisma.supplier.findFirst({
            where: { id: data.supplierId, organizationId: session.organizationId },
        });

        if (!supplier) {
            return { success: false, error: "Supplier not found" };
        }

        // The bill, if one was named: it has to be this supplier's, still
        // unpaid, and not already settled by another payment.
        let bill: { id: string; amount: number } | null = null;
        if (data.expenseId) {
            const found = await prisma.expense.findFirst({
                where: {
                    id: data.expenseId,
                    organizationId: session.organizationId,
                    supplierId: data.supplierId,
                },
                select: { id: true, amount: true, isPaid: true, supplierPayment: { select: { id: true } } },
            });
            if (!found) {
                return { success: false, error: "That bill is not on this supplier's account" };
            }
            if (found.supplierPayment) {
                return { success: false, error: "That bill has already been settled by another payment" };
            }
            if (found.isPaid) {
                return { success: false, error: "That bill is already marked paid" };
            }
            bill = { id: found.id, amount: found.amount };
        }

        // The payment and the balance it settles are one write. They were two,
        // so a failure in between left the supplier still owing money that had
        // been paid, with a payment on record saying otherwise.
        const payment = await prisma.$transaction(async (tx) => {
            const created = await tx.supplierPayment.create({
                data: {
                    organizationId: session.organizationId,
                    supplierId: data.supplierId,
                    amount: data.amount,
                    paymentDate: data.paymentDate,
                    method: data.method,
                    customMethod: data.method === "other" ? data.customMethod : null,
                    reference: data.reference,
                    description: data.description,
                    notes: data.notes,
                    accountId: data.accountId || null,
                    expenseId: bill?.id ?? null,
                },
            });

            // A settled bill is marked paid here rather than separately, so
            // the balance below moves once for it instead of twice.
            if (bill) {
                await tx.expense.update({
                    where: { id: bill.id },
                    data: { isPaid: true, paidDate: data.paymentDate },
                });
            }

            // Reduce what we owe them.
            await tx.supplier.update({
                where: { id: data.supplierId },
                data: { balance: { decrement: data.amount } },
            });

            // And take the money out of the account it actually left. Paying a
            // supplier $5,000 used to move the supplier's balance and leave
            // Bank untouched, so the cost reached the books nowhere an account
            // could see it.
            if (data.accountId) {
                await debitAccountForSupplierPayment(tx, {
                    accountId: data.accountId,
                    amount: data.amount,
                    description: `Paid ${supplier.name}${data.description ? ` — ${data.description}` : ""}`,
                    date: data.paymentDate,
                    createdById: session.user.id,
                });
            }

            return created;
        });

        revalidatePath("/finance/supplier-payments");
        revalidatePath(`/suppliers/${data.supplierId}`);
        return { success: true, payment };
    } catch (error) {
        console.error("Failed to create supplier payment:", error);
        return { success: false, error: "Failed to create supplier payment" };
    }
}

export async function updateSupplierPayment(
    id: string,
    data: {
        amount?: number;
        paymentDate?: Date;
        method?: PaymentMethod;
        customMethod?: string;
        reference?: string;
        description?: string;
        notes?: string;
        accountId?: string | null;
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
    entityType: "supplier_payment",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

    try {
        const existingPayment = await prisma.supplierPayment.findFirst({
            where: { id, organizationId: session.organizationId },
        });

        if (!existingPayment) {
            return { success: false, error: "Payment not found" };
        }

        const payment = await prisma.$transaction(async (tx) => {
            // If the amount changed, the difference goes back on what we owe.
            if (data.amount !== undefined && data.amount !== existingPayment.amount) {
                await tx.supplier.update({
                    where: { id: existingPayment.supplierId },
                    data: {
                        balance: { increment: existingPayment.amount - data.amount },
                    },
                });
            }

            const written = await tx.supplierPayment.update({
                where: { id },
                data: {
                    amount: data.amount,
                    paymentDate: data.paymentDate,
                    method: data.method,
                    customMethod: data.method === "other" ? data.customMethod : null,
                    reference: data.reference,
                    description: data.description,
                    notes: data.notes,
                    ...(data.accountId !== undefined && { accountId: data.accountId || null }),
                },
            });

            // Put the old payment back and take the new one out, rather than
            // nudging a difference: an edit can move the amount, the date and
            // which account it came from all at once.
            if (existingPayment.accountId) {
                await creditAccountForSupplierReversal(tx, {
                    accountId: existingPayment.accountId,
                    amount: existingPayment.amount,
                    description: "Supplier payment corrected",
                    date: written.paymentDate,
                    createdById: session.user.id,
                });
            }
            if (written.accountId) {
                await debitAccountForSupplierPayment(tx, {
                    accountId: written.accountId,
                    amount: written.amount,
                    description: "Supplier payment",
                    date: written.paymentDate,
                    createdById: session.user.id,
                });
            }

            return written;
        });

        revalidatePath("/finance/supplier-payments");
        revalidatePath(`/suppliers/${existingPayment.supplierId}`);
        return { success: true, payment };
    } catch (error) {
        console.error("Failed to update supplier payment:", error);
        return { success: false, error: "Failed to update supplier payment" };
    }
}

export async function deleteSupplierPayment(id: string,
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
    entityType: "supplier_payment",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

    try {
        const payment = await prisma.supplierPayment.findFirst({
            where: { id, organizationId: session.organizationId },
        });

        if (!payment) {
            return { success: false, error: "Payment not found" };
        }

        await prisma.$transaction(async (tx) => {
            // A bill this payment settled goes back to unpaid, or the supplier
            // page would show nothing owing for a payment that no longer
            // exists.
            if (payment.expenseId) {
                await tx.expense.update({
                    where: { id: payment.expenseId },
                    data: { isPaid: false, paidDate: null },
                });
            }

            // Removing the payment puts the debt back.
            await tx.supplier.update({
                where: { id: payment.supplierId },
                data: { balance: { increment: payment.amount } },
            });

            // And the money back into the account it left.
            if (payment.accountId) {
                await creditAccountForSupplierReversal(tx, {
                    accountId: payment.accountId,
                    amount: payment.amount,
                    description: "Supplier payment removed",
                    date: new Date(),
                    createdById: session.user.id,
                });
            }

            await tx.supplierPayment.delete({ where: { id } });
        });

        revalidatePath("/finance/supplier-payments");
        revalidatePath(`/suppliers/${payment.supplierId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete supplier payment:", error);
        return { success: false, error: "Failed to delete supplier payment" };
    }
}
