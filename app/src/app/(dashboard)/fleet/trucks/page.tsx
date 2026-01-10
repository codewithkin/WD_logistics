import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TrucksTable } from "./_components/trucks-table";
import { Plus } from "lucide-react";

export default async function TrucksPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const trucks = await prisma.truck.findMany({
        where: { organizationId },
        include: {
            assignedDriver: true,
            _count: {
                select: {
                    trips: true,
                },
            },
        },
        orderBy: { registrationNo: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Trucks"
                description="Manage your fleet of trucks"
                action={
                    canCreate
                        ? {
                            label: "Add Truck",
                            href: "/fleet/trucks/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <TrucksTable trucks={trucks} role={role} />
        </div>
    );
}
