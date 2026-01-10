import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentForm } from "../_components/payment-form";

interface NewPaymentPageProps {
    searchParams: Promise<{ invoiceId?: string }>;
}

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
    const params = await searchParams;
    const session = await requireRole(["admin", "supervisor"]);

    const invoicesWithPayments = await prisma.invoice.findMany({
        where: {
            organizationId: session.organizationId,
            status: { notIn: ["paid", "cancelled"] },
        },
        include: {
            customer: {
                select: { name: true },
            },
            payments: {
                select: { amount: true },
            },
        },
        orderBy: { issueDate: "desc" },
    });

    const invoices = invoicesWithPayments.map((invoice) => {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount,
            balance: invoice.totalAmount - totalPaid,
            customer: invoice.customer,
        };
    });

    return (
        <div>
            <PageHeader
                title="Record Payment"
                description="Record a new payment"
                backHref="/finance/payments"
            />
            <PaymentForm invoices={invoices} defaultInvoiceId={params.invoiceId} />
        </div>
    );
}
