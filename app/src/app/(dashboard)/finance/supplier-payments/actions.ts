"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { PaymentMethod } from "@/lib/types";

export async function createSupplierPayment(data: {
    supplierId: string;
    amount: number;
    paymentDate: Date;
    method: PaymentMethod;
    customMethod?: string;
    reference?: string;
    description?: string;
    notes?: string;
}) {
    const session = await requireRole(["admin", "supervisor"]);

    try {
        const supplier = await prisma.supplier.findFirst({
            where: { id: data.supplierId, organizationId: session.organizationId },
        });

        if (!supplier) {
            return { success: false, error: "Supplier not found" };
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
                },
            });

            // Reduce what we owe them.
            await tx.supplier.update({
                where: { id: data.supplierId },
                data: { balance: { decrement: data.amount } },
            });

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

            return tx.supplierPayment.update({
                where: { id },
                data: {
                    amount: data.amount,
                    paymentDate: data.paymentDate,
                    method: data.method,
                    customMethod: data.method === "other" ? data.customMethod : null,
                    reference: data.reference,
                    description: data.description,
                    notes: data.notes,
                },
            });
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
            // Removing the payment puts the debt back.
            await tx.supplier.update({
                where: { id: payment.supplierId },
                data: { balance: { increment: payment.amount } },
            });

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
