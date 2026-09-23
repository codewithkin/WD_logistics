import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierPaymentForm } from "../_components/supplier-payment-form";

interface NewSupplierPaymentPageProps {
    searchParams: Promise<{ supplierId?: string }>;
}

export default async function NewSupplierPaymentPage({ searchParams }: NewSupplierPaymentPageProps) {
    const params = await searchParams;
    const session = await requireRole(["admin", "supervisor"]);

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
