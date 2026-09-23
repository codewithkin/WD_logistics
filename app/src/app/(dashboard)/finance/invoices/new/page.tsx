import { requireRole } from "@/lib/session";
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
    await requireRole(["admin", "supervisor"]);
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
