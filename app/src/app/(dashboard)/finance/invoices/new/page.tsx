import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";
import { generateInvoiceNumber } from "../actions";

interface NewInvoicePageProps {
    searchParams: Promise<{ tripId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
    const params = await searchParams;
    const session = await requireRole(["admin", "supervisor"]);

    const [customers, trips, defaultInvoiceNumber] = await Promise.all([
        prisma.customer.findMany({
            where: { organizationId: session.organizationId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.trip.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, origin: true, destination: true, customerId: true },
            orderBy: { startDate: "desc" },
        }),
        generateInvoiceNumber(session.organizationId),
    ]);

    return (
        <div>
            <PageHeader
                title="Create Invoice"
                description="Create a new invoice"
                backHref="/finance/invoices"
            />
            <InvoiceForm
                customers={customers}
                trips={trips}
                defaultInvoiceNumber={defaultInvoiceNumber}
                defaultTripId={params.tripId}
            />
        </div>
    );
}
