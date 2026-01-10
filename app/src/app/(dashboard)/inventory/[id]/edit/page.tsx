import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryItemForm } from "../../_components/inventory-form";

interface EditInventoryItemPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditInventoryItemPage({
    params,
}: EditInventoryItemPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const item = await prisma.inventoryItem.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!item) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Inventory Item"
                description={item.name}
                backHref={`/inventory/${item.id}`}
            />
            <InventoryItemForm item={item} />
        </div>
    );
}
