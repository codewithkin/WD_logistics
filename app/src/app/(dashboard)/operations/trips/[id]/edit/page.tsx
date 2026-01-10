import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "../../_components/trip-form";

interface EditTripPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTripPage({ params }: EditTripPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const trip = await prisma.trip.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!trip) {
        notFound();
    }

    const [trucks, drivers, customers] = await Promise.all([
        prisma.truck.findMany({
            where: {
                organizationId: session.organizationId,
                OR: [{ status: "available" }, { id: trip.truckId }],
            },
            select: { id: true, registrationNo: true },
            orderBy: { registrationNo: "asc" },
        }),
        prisma.driver.findMany({
            where: {
                organizationId: session.organizationId,
                OR: [{ status: "available" }, { id: trip.driverId }],
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.customer.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <div>
            <PageHeader
                title="Edit Trip"
                description={`Update trip: ${trip.origin} → ${trip.destination}`}
                backHref={`/operations/trips/${trip.id}`}
            />
            <TripForm trip={trip} trucks={trucks} drivers={drivers} customers={customers} />
        </div>
    );
}
