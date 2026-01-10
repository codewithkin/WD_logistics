import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DriversTable } from "./_components/drivers-table";
import { Plus } from "lucide-react";

export default async function DriversPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const drivers = await prisma.driver.findMany({
        where: { organizationId },
        include: {
            assignedTruck: true,
            _count: {
                select: {
                    trips: true,
                },
            },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Drivers"
                description="Manage your fleet drivers"
                action={
                    canCreate
                        ? {
                            label: "Add Driver",
                            href: "/fleet/drivers/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <DriversTable drivers={drivers} role={role} />
        </div>
    );
}
