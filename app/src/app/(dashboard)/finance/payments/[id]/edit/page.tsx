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

    const payment = await prisma.payment.findFirst({
        where: {
            id,
            invoice: { organizationId: session.organizationId }
        },
        include: {
            invoice: {
                include: {
                    customer: { select: { id: true, name: true } },
                    payments: { select: { amount: true } },
                },
            },
        },
    });

    if (!payment) {
        notFound();
    }

    const totalPaid = payment.invoice.payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);

    const invoices = [
        {
            id: payment.invoice.id,
            invoiceNumber: payment.invoice.invoiceNumber,
            total: payment.invoice.total,
            balance: payment.invoice.total - totalPaid + payment.amount, // Add back current payment
            customerId: payment.invoice.customerId,
            customer: payment.invoice.customer,
        },
    ];

    return (
        <div>
            <PageHeader
                title="Edit Payment"
                description="Update payment details"
                backHref="/finance/payments"
            />
            <PaymentForm payment={payment} invoices={invoices} />
        </div>
    );
}
