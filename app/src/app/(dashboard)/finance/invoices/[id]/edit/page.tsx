import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../../_components/invoice-form";

interface EditInvoicePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
    const { id } = await params;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="editing an invoice" />;
    const session = access.session;

    const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            customer: { select: { id: true, name: true, contactPerson: true } },
            // So an existing trip link reads as a route and a date in the
            // picker rather than an id — and so a missing one is visibly
            // missing, which is how it can finally be repaired here.
            trip: {
                select: {
                    id: true,
                    originCity: true,
                    destinationCity: true,
                    scheduledDate: true,
                    truck: { select: { registrationNo: true } },
                },
            },
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
                initialTrip={
                    invoice.trip
                        ? {
                              id: invoice.trip.id,
                              label: `${invoice.trip.originCity} → ${invoice.trip.destinationCity}`,
                              description: [
                                  invoice.trip.truck?.registrationNo,
                                  invoice.trip.scheduledDate.toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                  }),
                              ]
                                  .filter(Boolean)
                                  .join(" · "),
                          }
                        : undefined
                }
            />
        </div>
    );
}
