import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../../_components/invoice-form";

interface EditInvoicePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor", "staff"]);

    const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            customer: { select: { id: true, name: true, contactPerson: true } },
        },
    });

    if (!invoice) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Invoice"
                description={`Update invoice ${invoice.invoiceNumber}`}
                backHref={`/finance/invoices/${invoice.id}`}
            />
            <InvoiceForm
                invoice={invoice}
                initialCustomer={{
                    id: invoice.customer.id,
                    label: invoice.customer.name,
                    description: invoice.customer.contactPerson ?? undefined,
                }}
            />
        </div>
    );
}
