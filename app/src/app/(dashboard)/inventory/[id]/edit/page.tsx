import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryForm } from "../../_components/inventory-form";
import { canViewInventoryValue } from "@/lib/permissions";

interface EditInventoryItemPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditInventoryItemPage({ params }: EditInventoryItemPageProps) {
    const { id } = await params;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="editing a stock item" />;
    const session = access.session;

    const [item, labels] = await Promise.all([
        prisma.inventoryItem.findFirst({
            where: { id, organizationId: session.organizationId },
            include: { defaultExpenseCategory: { select: { id: true, name: true } } },
        }),
        prisma.inventoryLabel.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, name: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
    ]);

    if (!item) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Inventory Item"
                description={`Editing ${item.name}`}
                backHref={`/inventory/${item.id}`}
            />
            <InventoryForm
                item={item}
                labels={labels}
                defaultExpenseCategory={
                    item.defaultExpenseCategory
                        ? { id: item.defaultExpenseCategory.id, label: item.defaultExpenseCategory.name }
                        : null
                }
                canSeeValue={canViewInventoryValue(session.role)}
            />
        </div>
    );
}
