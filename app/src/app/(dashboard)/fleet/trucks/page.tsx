import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
    const session = await requireAuth();
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
            trips: {
                where: {
                    scheduledDate: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
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

    // Transform data to include calculated totals for the period
    const trucksWithTotals = trucks.map((truck) => ({
        ...truck,
        totalExpenses: truck.truckExpenses.reduce((sum, te) => sum + te.expense.amount, 0),
        totalRevenue: truck.trips.reduce((sum, t) => sum + t.revenue, 0),
        tripsInPeriod: truck.trips.length,
    }));

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Trucks"
                    description={`Manage your fleet of trucks - ${dateRange.label}`}
                />
                <div className="flex items-center gap-2">
                    <PagePeriodSelector defaultPreset="3m" />
                    {canCreate && (
                        <Link href="/fleet/trucks/new">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Truck
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <TrucksTable trucks={trucksWithTotals} role={role} periodLabel={dateRange.label} />
        </div>
    );
}
