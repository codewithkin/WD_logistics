import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TripsTable } from "./_components/trips-table";
import { TripsAnalytics } from "./_components/trips-analytics";
import { Plus } from "lucide-react";

interface TripsPageProps {
    searchParams: Promise<{ truckId?: string; driverId?: string; customerId?: string }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const whereClause: Record<string, unknown> = { organizationId };

    if (params.truckId) {
        whereClause.truckId = params.truckId;
    }
    if (params.driverId) {
        whereClause.driverId = params.driverId;
    }
    if (params.customerId) {
        whereClause.customerId = params.customerId;
    }

    const trips = await prisma.trip.findMany({
        where: whereClause,
        include: {
            truck: true,
            driver: true,
            customer: true,
        },
        orderBy: { scheduledDate: "desc" },
    });

    // Calculate analytics
    const totalTrips = trips.length;
    const completedTrips = trips.filter(t => t.status === "completed").length;
    const inProgressTrips = trips.filter(t => t.status === "in_progress").length;
    const scheduledTrips = trips.filter(t => t.status === "scheduled").length;
    const cancelledTrips = trips.filter(t => t.status === "cancelled").length;
    const totalRevenue = trips.reduce((sum, t) => sum + t.revenue, 0);
    const totalMileage = trips.reduce((sum, t) => sum + (t.actualMileage || t.estimatedMileage), 0);
    const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;

    const analytics = {
        totalTrips,
        completedTrips,
        inProgressTrips,
        scheduledTrips,
        cancelledTrips,
        totalRevenue,
        totalMileage,
        completionRate,
    };

    const canCreate = role === "admin" || role === "supervisor";
    const canExport = role === "admin";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Trips"
                description="Manage and track all trips"
                action={
                    canCreate
                        ? {
                            label: "Create Trip",
                            href: "/operations/trips/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <TripsAnalytics analytics={analytics} trips={trips} canExport={canExport} />
            <TripsTable trips={trips} role={role} />
        </div>
    );
}
