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

    const suppliers = await prisma.supplier.findMany({
        where: {
            organizationId: session.organizationId,
            status: "active",
        },
        select: {
            id: true,
            name: true,
            balance: true,
        },
        orderBy: { name: "asc" },
    });

    return (
        <div>
            <PageHeader
                title="Record Supplier Payment"
                description="Record a payment made to a supplier"
                backHref="/finance/supplier-payments"
            />
            <SupplierPaymentForm suppliers={suppliers} defaultSupplierId={params.supplierId} />
        </div>
    );
}
