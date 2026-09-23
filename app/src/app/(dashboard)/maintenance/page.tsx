import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { MaintenanceRequestsClient } from "./_components/maintenance-requests-client";
import { WorkshopTaskCards } from "./_components/workshop-task-cards";
import { MaintenanceHistoryPanel } from "./_components/maintenance-history-panel";
import { UNFINISHED_STATUSES } from "./_lib/status";
import { buildMaintenanceHistory } from "./_lib/history";

interface MaintenancePageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string; status?: string }>;
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
    const session = await requireRole(["admin", "supervisor", "workshop"]);
    const params = await searchParams;
    const isWorkshop = session.role === "workshop";
    const canManage = session.role === "admin" || session.role === "supervisor";

    // Workshop works to a job list, not a reporting period: they see everything
    // still assigned to them regardless of when it was logged. Admin and
    // supervisor get the universal period filter (default 3 months, since
    // maintenance history is the point of this screen).
    const range = canManage ? getDateRangeFromParams(params, "3m") : null;

    const [requests] = await Promise.all([
        prisma.maintenanceRequest.findMany({
            where: {
                organizationId: session.organizationId,
                // Fixed jobs are done as far as workshop is concerned, and a
                // worker only ever sees their own. Enforced here rather than in
                // the client filter so it can't be reached by URL either.
                ...(isWorkshop
                    ? {
                          assignedToId: session.user.id,
                          status: { in: [...UNFINISHED_STATUSES] },
                      }
                    : {
                          // The period narrows the *history*: a job counts if
                          // it was scheduled or closed inside it. Work that
                          // isn't finished always stays on the list, however
                          // it's dated — otherwise a job booked for next week
                          // vanishes from the office's screen.
                          OR: [
                              { date: { gte: range!.from, lte: range!.to } },
                              { fixedAt: { gte: range!.from, lte: range!.to } },
                              { status: { in: [...UNFINISHED_STATUSES] } },
                          ],
                      }),
            },
            include: {
                truck: { select: { id: true, registrationNo: true, make: true, model: true } },
                trailer: { select: { id: true, registrationNo: true, make: true, model: true } },
                reportedBy: { select: { name: true } },
                fixedBy: { select: { name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { date: "desc" },
        }),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title={isWorkshop ? "My Workshop Tasks" : "Maintenance Requests"}
                    description={
                        isWorkshop
                            ? "Jobs assigned to you. They disappear from here once you close them."
                            : "Truck and trailer issues logged for the workshop"
                    }
                />
                {canManage && <PagePeriodSelector defaultPreset="3m" />}
            </div>

            {isWorkshop && <WorkshopTaskCards requests={requests} />}

            <MaintenanceRequestsClient
                requests={requests}
                role={session.role}
                currentUserId={session.user.id}
            />

            {canManage && (
                <MaintenanceHistoryPanel
                    rows={buildMaintenanceHistory(requests)}
                    periodLabel={range!.label}
                />
            )}
        </div>
    );
}
