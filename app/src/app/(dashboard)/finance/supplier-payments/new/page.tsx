import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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

    return (
        <div>
            <PageHeader
                title="Record Supplier Payment"
                description="Record a payment made to a supplier"
                backHref="/finance/supplier-payments"
            />
            <SupplierPaymentForm
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
