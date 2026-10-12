import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureAccountsExist } from "@/lib/accounts-server";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierPaymentForm } from "../_components/supplier-payment-form";

interface NewSupplierPaymentPageProps {
    searchParams: Promise<{ supplierId?: string }>;
}

export default async function NewSupplierPaymentPage({ searchParams }: NewSupplierPaymentPageProps) {
    const params = await searchParams;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="paying a supplier" />;
    const session = access.session;

    // Only a supplier arrived at via ?supplierId is loaded, to seed the
    // picker; it searches the org for everything else.
    const prefilled = params.supplierId
        ? await prisma.supplier.findFirst({
              where: { id: params.supplierId, organizationId: session.organizationId },
              select: { id: true, name: true, balance: true, contactPerson: true },
          })
        : null;

    // The account a supplier is usually settled from, offered first, and the
    // three ensured so the picker is never empty on a system that has not
    // visited the Accounts page.
    await ensureAccountsExist(session.organizationId);
    const accounts = await prisma.financialAccount.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true, name: true, type: true },
    });
    const bank = accounts.find((account) => account.type === "bank") ?? accounts[0];

    return (
        <div>
            <PageHeader
                title="Record Supplier Payment"
                description="Record a payment made to a supplier"
                backHref="/finance/supplier-payments"
            />
            <SupplierPaymentForm
                defaultAccountId={bank?.id ?? null}
                initialAccount={bank ? { id: bank.id, label: bank.name } : undefined}
                defaultSupplierId={prefilled?.id}
                initialSupplier={
                    prefilled
                        ? {
                              id: prefilled.id,
                              label: prefilled.name,
                              description: prefilled.contactPerson ?? undefined,
                              data: { balance: prefilled.balance },
                          }
                        : undefined
                }
            />
        </div>
    );
}
