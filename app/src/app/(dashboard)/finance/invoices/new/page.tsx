import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";
import { generateInvoiceNumber } from "../actions";

interface NewInvoicePageProps {
    searchParams: Promise<{
        customerId?: string;
        subtotal?: string;
    }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
    const session = await requireRole(["admin", "supervisor"]);
    const params = await searchParams;

    const [customers, defaultInvoiceNumber] = await Promise.all([
        prisma.customer.findMany({
            where: { organizationId: session.organizationId, status: "active" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        generateInvoiceNumber(session.organizationId),
    ]);

    // Parse prefilled values from search params
    const prefilledCustomerId = params.customerId || undefined;
    const prefilledSubtotal = params.subtotal ? parseFloat(params.subtotal) : undefined;

    return (
        <div>
            <PageHeader
                title="Create Invoice"
                description="Create a new invoice"
                backHref="/finance/invoices"
            />
            <InvoiceForm
                customers={customers}
                defaultInvoiceNumber={defaultInvoiceNumber}
                prefilledCustomerId={prefilledCustomerId}
                prefilledSubtotal={prefilledSubtotal}
            />
        </div>
    );
}
