"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
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

        const payment = await prisma.supplierPayment.create({
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

        // Update supplier balance (reduce amount owed)
        await prisma.supplier.update({
            where: { id: data.supplierId },
            data: {
                balance: {
                    decrement: data.amount,
                },
            },
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
    }
) {
    const session = await requireRole(["admin", "supervisor"]);

    try {
        const existingPayment = await prisma.supplierPayment.findFirst({
            where: { id, organizationId: session.organizationId },
        });

        if (!existingPayment) {
            return { success: false, error: "Payment not found" };
        }

        // If amount changed, adjust supplier balance
        if (data.amount !== undefined && data.amount !== existingPayment.amount) {
            const difference = existingPayment.amount - data.amount;
            await prisma.supplier.update({
                where: { id: existingPayment.supplierId },
                data: {
                    balance: {
                        increment: difference,
                    },
                },
            });
        }

        const payment = await prisma.supplierPayment.update({
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

        revalidatePath("/finance/supplier-payments");
        revalidatePath(`/suppliers/${existingPayment.supplierId}`);
        return { success: true, payment };
    } catch (error) {
        console.error("Failed to update supplier payment:", error);
        return { success: false, error: "Failed to update supplier payment" };
    }
}

export async function deleteSupplierPayment(id: string) {
    const session = await requireRole(["admin"]);

    try {
        const payment = await prisma.supplierPayment.findFirst({
            where: { id, organizationId: session.organizationId },
        });

        if (!payment) {
            return { success: false, error: "Payment not found" };
        }

        // Restore supplier balance
        await prisma.supplier.update({
            where: { id: payment.supplierId },
            data: {
                balance: {
                    increment: payment.amount,
                },
            },
        });

        await prisma.supplierPayment.delete({
            where: { id },
        });

        revalidatePath("/finance/supplier-payments");
        revalidatePath(`/suppliers/${payment.supplierId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete supplier payment:", error);
        return { success: false, error: "Failed to delete supplier payment" };
    }
}
