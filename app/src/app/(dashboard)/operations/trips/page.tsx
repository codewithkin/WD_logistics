import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TripsTable } from "./_components/trips-table";
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

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
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
            <TripsTable trips={trips} role={role} />
        </div>
    );
}
