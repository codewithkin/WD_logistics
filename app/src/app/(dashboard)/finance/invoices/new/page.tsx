import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
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
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="raising an invoice" />;
    const params = await searchParams;

    // The customer picker searches the org itself, so nothing is preloaded.
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
                prefilledCustomerId={prefilledCustomerId}
                prefilledAmount={prefilledAmount}
                prefilledTripId={prefilledTripId}
            />
        </div>
    );
}
