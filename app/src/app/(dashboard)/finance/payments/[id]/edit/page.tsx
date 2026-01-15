import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentForm } from "../../_components/payment-form";

interface EditPaymentPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditPaymentPage({ params }: EditPaymentPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    // Get payment with optional invoice (payments can now be without invoices)
    const payment = await prisma.payment.findFirst({
        where: {
            id,
            customer: { organizationId: session.organizationId }
        },
        include: {
            invoice: {
                include: {
                    customer: { select: { id: true, name: true } },
                    payments: { select: { amount: true } },
                },
            },
            customer: { select: { id: true, name: true } },
        },
    });

    if (!payment) {
        notFound();
    }

    // Build invoices array - include the linked invoice if exists
    const invoices = payment.invoice ? [
        {
            id: payment.invoice.id,
            invoiceNumber: payment.invoice.invoiceNumber,
            total: payment.invoice.total,
            balance: payment.invoice.total - payment.invoice.payments.reduce((sum, p) => sum + p.amount, 0) + payment.amount,
            customerId: payment.invoice.customerId,
            customer: payment.invoice.customer,
        },
    ] : [];

    // Get customer for the form (in case editing needs it)
    const customers = [payment.customer];

    return (
        <div>
            <PageHeader
                title="Edit Payment"
                description="Update payment details"
                backHref="/finance/payments"
            />
            <PaymentForm payment={payment} invoices={invoices} customers={customers} />
        </div>
    );
}
