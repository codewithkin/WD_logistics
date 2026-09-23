import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentForm } from "../../_components/payment-form";

interface EditPaymentPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditPaymentPage({ params }: EditPaymentPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor", "staff"]);

    // Get payment with optional invoice (payments can now be without invoices)
    const payment = await prisma.payment.findFirst({
        where: {
            id,
            customer: { organizationId: session.organizationId }
        },
        include: {
            invoice: {
                include: {
                    customer: { select: { id: true, name: true } },
                    payments: { select: { amount: true } },
                },
            },
            customer: { select: { id: true, name: true } },
        },
    });

    if (!payment) {
        notFound();
    }

    // The balance to show is what the invoice owed *before* this payment, so
    // the amount being edited reads as available rather than already applied.
    const invoiceBalanceBeforeThisPayment = payment.invoice
        ? payment.invoice.total -
          payment.invoice.payments.reduce((sum, p) => sum + p.amount, 0) +
          payment.amount
        : 0;

    return (
        <div>
            <PageHeader
                title="Edit Payment"
                description="Update payment details"
                backHref="/finance/payments"
            />
            <PaymentForm
                payment={payment}
                initialSelected={{
                    invoice: payment.invoice
                        ? {
                              id: payment.invoice.id,
                              label: payment.invoice.invoiceNumber,
                              description: payment.invoice.customer.name,
                              data: {
                                  customerId: payment.invoice.customerId,
                                  customerName: payment.invoice.customer.name,
                                  total: payment.invoice.total,
                                  balance: invoiceBalanceBeforeThisPayment,
                              },
                          }
                        : undefined,
                    customer: {
                        id: payment.customer.id,
                        label: payment.customer.name,
                    },
                }}
            />
        </div>
    );
}
