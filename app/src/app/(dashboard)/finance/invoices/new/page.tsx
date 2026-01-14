import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";

interface NewInvoicePageProps {
    searchParams: Promise<{
        customerId?: string;
        amount?: string;
        tripId?: string;
    }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
    const session = await requireRole(["admin", "supervisor"]);
    const params = await searchParams;

    const customers = await prisma.customer.findMany({
        where: { organizationId: session.organizationId, status: "active" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    // Parse prefilled values from search params
    const prefilledCustomerId = params.customerId || undefined;
    const prefilledAmount = params.amount ? parseFloat(params.amount) : undefined;
    const prefilledTripId = params.tripId || undefined;

    return (
        <div>
            <PageHeader
                title="Create Invoice"
                description="Create a new invoice"
                backHref="/finance/invoices"
            />
            <InvoiceForm
                customers={customers}
                prefilledCustomerId={prefilledCustomerId}
                prefilledAmount={prefilledAmount}
                prefilledTripId={prefilledTripId}
            />
        </div>
    );
}
