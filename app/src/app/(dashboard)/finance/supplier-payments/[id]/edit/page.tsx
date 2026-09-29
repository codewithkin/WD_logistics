// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierPaymentForm } from "../../_components/supplier-payment-form";
import { notFound } from "next/navigation";

interface EditSupplierPaymentPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditSupplierPaymentPage({ params }: EditSupplierPaymentPageProps) {
    const { id } = await params;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="editing a supplier payment" />;
    const session = access.session;

    const payment = await prisma.supplierPayment.findFirst({
        where: {
            id,
            organizationId: session.organizationId,
        },
        include: {
            supplier: {
                select: { id: true, name: true, balance: true, contactPerson: true },
            },
        },
    });

    if (!payment) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Supplier Payment"
                description="Update payment details"
                backHref="/finance/supplier-payments"
            />
            <SupplierPaymentForm
                payment={payment}
                initialSupplier={{
                    id: payment.supplier.id,
                    label: payment.supplier.name,
                    description: payment.supplier.contactPerson ?? undefined,
                    data: { balance: payment.supplier.balance },
                }}
            />
        </div>
    );
}
