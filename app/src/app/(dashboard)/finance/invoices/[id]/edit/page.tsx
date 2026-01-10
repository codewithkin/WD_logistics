import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../../_components/invoice-form";

interface EditInvoicePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!invoice) {
        notFound();
    }

    const [customers, trips] = await Promise.all([
        prisma.customer.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.trip.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, origin: true, destination: true, customerId: true },
            orderBy: { startDate: "desc" },
        }),
    ]);

    return (
        <div>
            <PageHeader
                title="Edit Invoice"
                description={`Update invoice ${invoice.invoiceNumber}`}
                backHref={`/finance/invoices/${invoice.id}`}
            />
            <InvoiceForm
                invoice={invoice}
                customers={customers}
                trips={trips}
                defaultInvoiceNumber={invoice.invoiceNumber}
            />
        </div>
    );
}
