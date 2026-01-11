import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DriversTable } from "./_components/drivers-table";
import { DriversAnalytics } from "./_components/drivers-analytics";
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

    // Calculate analytics
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === "active").length;
    const inactiveDrivers = drivers.filter(d => d.status === "inactive").length;
    const onLeaveDrivers = drivers.filter(d => d.status === "on_leave").length;
    const terminatedDrivers = drivers.filter(d => d.status === "terminated").length;
    const driversWithTruck = drivers.filter(d => d.assignedTruck !== null).length;
    const driversWithoutTruck = drivers.filter(d => d.assignedTruck === null).length;
    const totalTrips = drivers.reduce((sum, d) => sum + d._count.trips, 0);

    // License type breakdown
    const licenseBreakdown = drivers.reduce((acc, d) => {
        const license = d.licenseType || "Unknown";
        if (!acc[license]) {
            acc[license] = { type: license, count: 0 };
        }
        acc[license].count += 1;
        return acc;
    }, {} as Record<string, { type: string; count: number }>);

    const analytics = {
        totalDrivers,
        activeDrivers,
        inactiveDrivers,
        onLeaveDrivers,
        terminatedDrivers,
        driversWithTruck,
        driversWithoutTruck,
        totalTrips,
        licenseBreakdown: Object.values(licenseBreakdown),
    };

    const canCreate = role === "admin" || role === "supervisor";
    const canExport = role === "admin";

    return (
        <div className="space-y-6">
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
            <DriversAnalytics analytics={analytics} drivers={drivers} canExport={canExport} />
            <DriversTable drivers={drivers} role={role} />
        </div>
    );
}
