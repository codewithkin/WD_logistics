import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierForm } from "../../_components/supplier-form";

interface EditSupplierPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const supplier = await prisma.supplier.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!supplier) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Supplier"
                description={`Editing ${supplier.name}`}
                backHref={`/suppliers/${supplier.id}`}
            />
            <SupplierForm supplier={supplier} />
        </div>
    );
}
