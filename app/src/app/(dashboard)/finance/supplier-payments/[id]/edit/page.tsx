import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierPaymentForm } from "../../_components/supplier-payment-form";
import { notFound } from "next/navigation";

interface EditSupplierPaymentPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditSupplierPaymentPage({ params }: EditSupplierPaymentPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const payment = await prisma.supplierPayment.findFirst({
        where: {
            id,
            organizationId: session.organizationId,
        },
    });

    if (!payment) {
        notFound();
    }

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
                title="Edit Supplier Payment"
                description="Update payment details"
                backHref="/finance/supplier-payments"
            />
            <SupplierPaymentForm suppliers={suppliers} payment={payment} />
        </div>
    );
}
