import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "../_components/trip-form";

export default async function NewTripPage() {
    const session = await requireRole(["admin", "supervisor"]);
    const showFinancials = canViewFinancialData(session.role);

    const [trucks, drivers, customers] = await Promise.all([
        prisma.truck.findMany({
            where: { organizationId: session.organizationId, status: "active" },
            select: { id: true, registrationNo: true },
            orderBy: { registrationNo: "asc" },
        }),
        prisma.driver.findMany({
            where: { organizationId: session.organizationId, status: "active" },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: "asc" },
        }),
        prisma.customer.findMany({
            where: { organizationId: session.organizationId, status: "active" },
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
            <TripForm trucks={trucks} drivers={drivers} customers={customers} showFinancials={showFinancials} />
        </div>
    );
}
