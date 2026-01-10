import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";
import { generateInvoiceNumber } from "../actions";

export default async function NewInvoicePage() {
    const session = await requireRole(["admin", "supervisor"]);

    const [customers, defaultInvoiceNumber] = await Promise.all([
        prisma.customer.findMany({
            where: { organizationId: session.organizationId, status: "active" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
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
                defaultInvoiceNumber={defaultInvoiceNumber}
            />
        </div>
    );
}
