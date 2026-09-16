import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceRequestsClient } from "./_components/maintenance-requests-client";
import { getTrucksForMaintenance } from "./actions";

export default async function MaintenancePage() {
    const session = await requireRole(["admin", "supervisor", "workshop"]);
    const canLogIssue = session.role === "admin" || session.role === "supervisor";

    const [requests, trucks] = await Promise.all([
        prisma.maintenanceRequest.findMany({
            where: { organizationId: session.organizationId },
            include: {
                truck: { select: { id: true, registrationNo: true, make: true, model: true } },
                reportedBy: { select: { name: true } },
                fixedBy: { select: { name: true } },
            },
            orderBy: { date: "desc" },
        }),
        canLogIssue ? getTrucksForMaintenance() : Promise.resolve([]),
    ]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Maintenance Requests"
                description="Truck issues logged for the workshop"
            />
            <MaintenanceRequestsClient
                requests={requests}
                trucks={trucks}
                role={session.role}
            />
        </div>
    );
}
