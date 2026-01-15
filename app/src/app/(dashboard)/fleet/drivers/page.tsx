import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DriversTable } from "./_components/drivers-table";
import { DriversAnalytics } from "./_components/drivers-analytics";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DriversPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function DriversPage({ searchParams }: DriversPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "3m");

    // Get base driver data with trips in the selected period
    const driversData = await prisma.driver.findMany({
        where: { organizationId },
        include: {
            assignedTruck: {
                select: {
                    id: true,
                    registrationNo: true,
                },
            },
            trips: {
                where: {
                    scheduledDate: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
                },
                select: {
                    id: true,
                    revenue: true,
                    status: true,
                },
            },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    // Transform to include _count and totalRevenue for compatibility
    const drivers = driversData.map(d => ({
        ...d,
        _count: { trips: d.trips.length },
        totalRevenue: d.trips.reduce((sum, t) => sum + t.revenue, 0),
    }));

    // Calculate analytics
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === "active").length;
    const inactiveDrivers = drivers.filter(d => d.status === "inactive").length;
    const onLeaveDrivers = drivers.filter(d => d.status === "on_leave").length;
    const terminatedDrivers = drivers.filter(d => d.status === "terminated").length;
    const driversWithTruck = drivers.filter(d => d.assignedTruck !== null).length;
    const driversWithoutTruck = drivers.filter(d => d.assignedTruck === null).length;
    const totalTrips = drivers.reduce((sum, d) => sum + d._count.trips, 0);
    const totalRevenue = drivers.reduce((sum, d) => sum + d.totalRevenue, 0);

    const analytics = {
        totalDrivers,
        activeDrivers,
        inactiveDrivers,
        onLeaveDrivers,
        terminatedDrivers,
        driversWithTruck,
        driversWithoutTruck,
        totalTrips,
        totalRevenue,
        licenseBreakdown: [] as Array<{ type: string; count: number }>,
    };

    const canCreate = role === "admin" || role === "supervisor";
    const canExport = role === "admin";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Drivers"
                    description={`Manage your fleet drivers - ${dateRange.label}`}
                />
                <div className="flex items-center gap-2">
                    <PagePeriodSelector defaultPreset="3m" />
                    {canCreate && (
                        <Link href="/fleet/drivers/new">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Driver
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <DriversAnalytics analytics={analytics} drivers={drivers as any} canExport={canExport} periodLabel={dateRange.label} />
            <DriversTable drivers={drivers as any} role={role} />
        </div>
    );
}
