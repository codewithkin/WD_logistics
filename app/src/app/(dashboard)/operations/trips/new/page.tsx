import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "../_components/trip-form";

export default async function NewTripPage() {
    const session = await requireRole(["admin", "supervisor"]);

    const [trucks, drivers, customers] = await Promise.all([
        prisma.truck.findMany({
            where: { organizationId: session.organizationId, status: "available" },
            select: { id: true, registrationNo: true },
            orderBy: { registrationNo: "asc" },
        }),
        prisma.driver.findMany({
            where: { organizationId: session.organizationId, status: "available" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.customer.findMany({
            where: { organizationId: session.organizationId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <div>
            <PageHeader
                title="Create New Trip"
                description="Schedule a new trip"
                backHref="/operations/trips"
            />
            <TripForm trucks={trucks} drivers={drivers} customers={customers} />
        </div>
    );
}
