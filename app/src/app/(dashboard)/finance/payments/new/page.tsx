import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureAccountsExist } from "@/lib/accounts-server";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentForm } from "../_components/payment-form";

interface NewPaymentPageProps {
    searchParams: Promise<{ invoiceId?: string }>;
}

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
    const params = await searchParams;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="recording a payment" />;
    const session = access.session;

    // Only an invoice arrived at via ?invoiceId is loaded here, to seed the
    // picker and its summary panel. The pickers search for the rest.
    const prefilled = params.invoiceId
        ? await prisma.invoice.findFirst({
              where: { id: params.invoiceId, organizationId: session.organizationId },
              include: { customer: { select: { id: true, name: true } } },
          })
        : null;

    // The account the money most likely landed in, offered first. Bank is the
    // default for a reason: most receipts are transfers, and an admin who
    // leaves this alone should get the common answer rather than none. The
    // three accounts are ensured here so the picker is never empty on a
    // system that has not visited the Accounts page yet — which is what made
    // the account impossible to record at all after a reset.
    await ensureAccountsExist(session.organizationId);
    const accounts = await prisma.financialAccount.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true, name: true, type: true },
    });
    const bank = accounts.find((account) => account.type === "bank") ?? accounts[0];

    return (
        <div>
            <PageHeader
                title="Record Payment"
                description="Record a new payment"
                backHref="/finance/payments"
            />
            <PaymentForm
                defaultInvoiceId={prefilled?.id}
                defaultAccountId={bank?.id ?? null}
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
                              ...(bank ? { account: { id: bank.id, label: bank.name } } : {}),
                          }
                        : bank
                          ? { account: { id: bank.id, label: bank.name } }
                          : undefined
                }
            />
        </div>
    );
}
