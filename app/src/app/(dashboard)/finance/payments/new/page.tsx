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

    // Only an invoice arrived at via ?invoiceId is loaded here, to seed the
    // picker and its summary panel. The pickers search for the rest.
    const prefilled = params.invoiceId
        ? await prisma.invoice.findFirst({
              where: { id: params.invoiceId, organizationId: session.organizationId },
              include: { customer: { select: { id: true, name: true } } },
          })
        : null;

    return (
        <div>
            <PageHeader
                title="Record Payment"
                description="Record a new payment"
                backHref="/finance/payments"
            />
            <PaymentForm
                defaultInvoiceId={prefilled?.id}
                initialSelected={
                    prefilled
                        ? {
                              invoice: {
                                  id: prefilled.id,
                                  label: prefilled.invoiceNumber,
                                  description: prefilled.customer.name,
                                  data: {
                                      customerId: prefilled.customerId,
                                      customerName: prefilled.customer.name,
                                      total: prefilled.total,
                                      balance: prefilled.balance,
                                  },
                              },
                              customer: {
                                  id: prefilled.customer.id,
                                  label: prefilled.customer.name,
                              },
                          }
                        : undefined
                }
            />
        </div>
    );
}
