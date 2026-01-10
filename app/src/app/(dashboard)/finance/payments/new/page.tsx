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

    const invoices = await prisma.invoice.findMany({
        where: {
            organizationId: session.organizationId,
            status: { notIn: ["paid", "cancelled"] },
        },
        include: {
            customer: {
                select: { name: true },
            },
        },
        orderBy: { issueDate: "desc" },
    });

    const formattedInvoices = invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        balance: invoice.balance,
        customerId: invoice.customerId,
        customer: invoice.customer,
    }));

    return (
        <div>
            <PageHeader
                title="Record Payment"
                description="Record a new payment"
                backHref="/finance/payments"
            />
            <PaymentForm invoices={formattedInvoices} defaultInvoiceId={params.invoiceId} />
        </div>
    );
}
