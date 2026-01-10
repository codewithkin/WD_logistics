import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { AllocationForm } from "./_components/allocation-form";

interface AllocateInventoryPageProps {
    params: Promise<{ id: string }>;
}

export default async function AllocateInventoryPage({
    params,
}: AllocateInventoryPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const item = await prisma.inventoryItem.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!item) {
        notFound();
    }

    const [trucks, employees] = await Promise.all([
        prisma.truck.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, registrationNo: true },
            orderBy: { registrationNo: "asc" },
        }),
        prisma.employee.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, firstName: true, lastName: true, position: true },
            orderBy: { firstName: "asc" },
        }),
    ]);

    return (
        <div>
            <PageHeader
                title="Allocate Inventory"
                description={`Allocate ${item.name}`}
                backHref={`/inventory/${item.id}`}
            />
            <AllocationForm
                inventoryItemId={item.id}
                item={{
                    name: item.name,
                    quantity: item.quantity,
                }}
                trucks={trucks}
                employees={employees}
            />
        </div>
    );
}
