import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
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
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="the driver list" />;
    }
    const session = access.session;
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
    const suspendedDrivers = drivers.filter(d => d.status === "suspended").length;
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
        suspendedDrivers,
        terminatedDrivers,
        driversWithTruck,
        driversWithoutTruck,
        totalTrips,
        totalRevenue,
        // Was hardcoded to [], so the chart below it never rendered at all.
        // Licence *type* isn't recorded; what the office actually chases is
        // expiry, which is recorded and already drives the reminder cron.
        licenseBreakdown: buildLicenceStatus(drivers),
    };

    const canCreate = role === "admin" || role === "supervisor";
    const canExport = role === "admin";
    const showFinancials = canViewFinancialData(role);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Drivers"
                    description={`Manage your fleet drivers - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="3m" />
                    {canCreate && (
                        <Link href="/fleet/drivers/new" prefetch className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Driver
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <DriversAnalytics analytics={analytics} drivers={drivers as any} canExport={canExport} periodLabel={dateRange.label} showFinancials={showFinancials} />
            <DriversTable drivers={drivers as any} role={role} showFinancials={showFinancials} />
        </div>
    );
}

/** Licence expiry buckets for the drivers chart: what needs renewing, and when. */
function buildLicenceStatus(
    drivers: { licenseExpiration: Date | null }[],
): Array<{ type: string; count: number }> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const buckets = { expired: 0, expiringSoon: 0, valid: 0, unknown: 0 };
    for (const driver of drivers) {
        if (!driver.licenseExpiration) buckets.unknown += 1;
        else if (driver.licenseExpiration < now) buckets.expired += 1;
        else if (driver.licenseExpiration <= soon) buckets.expiringSoon += 1;
        else buckets.valid += 1;
    }

    return [
        { type: "Expired", count: buckets.expired },
        { type: "Expires within 30 days", count: buckets.expiringSoon },
        { type: "Valid", count: buckets.valid },
        { type: "No expiry recorded", count: buckets.unknown },
    ].filter((bucket) => bucket.count > 0);
}
