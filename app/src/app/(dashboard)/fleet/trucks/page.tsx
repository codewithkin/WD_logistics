import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { TrucksTable } from "./_components/trucks-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrucksPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function TrucksPage({ searchParams }: TrucksPageProps) {
    const params = await searchParams;
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="the truck list" />;
    }
    const session = access.session;
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "3m");

    const trucks = await prisma.truck.findMany({
        where: { organizationId },
        include: {
            assignedDriver: true,
            truckExpenses: {
                where: {
                    expense: {
                        date: {
                            gte: dateRange.from,
                            lte: dateRange.to,
                        },
                    },
                },
                include: {
                    expense: true,
                },
            },
            // Completed trips only, dated the way lib/metrics/revenue.ts
            // dates them — this used to count scheduled and cancelled trips
            // as revenue, so the list disagreed with every other screen.
            trips: {
                where: {
                    status: "completed",
                    OR: [
                        { endDate: { gte: dateRange.from, lte: dateRange.to } },
                        {
                            endDate: null,
                            scheduledDate: { gte: dateRange.from, lte: dateRange.to },
                        },
                    ],
                },
                select: {
                    revenue: true,
                },
            },
            _count: {
                select: {
                    trips: true,
                },
            },
        },
        orderBy: { registrationNo: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";
    const showFinancials = canViewFinancialData(role);

    // Totals are computed here and the underlying rows dropped. Spreading
    // `...truck` shipped every expense record to the browser — visible in the
    // RSC payload even for a supervisor who never sees a money column.
    const trucksWithTotals = trucks.map((truck) => {
        const { truckExpenses, trips, ...rest } = truck;
        const totalExpenses = truckExpenses.reduce(
            (sum, te) => sum + te.expense.amount,
            0,
        );
        const totalRevenue = trips.reduce((sum, t) => sum + t.revenue, 0);
        return {
            ...rest,
            totalExpenses: showFinancials ? totalExpenses : 0,
            totalRevenue: showFinancials ? totalRevenue : 0,
            tripsInPeriod: trips.length,
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Trucks"
                    description={`Manage your fleet of trucks - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="3m" />
                    {canCreate && (
                        <Link href="/fleet/trucks/new" prefetch className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Truck
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <TrucksTable trucks={trucksWithTotals} role={role} periodLabel={dateRange.label} showFinancials={showFinancials} />
        </div>
    );
}
