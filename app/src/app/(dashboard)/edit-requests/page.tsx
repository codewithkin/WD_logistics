import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { EditRequestsTable } from "./_components/edit-requests-table";

interface EditRequestsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function EditRequestsPage({ searchParams }: EditRequestsPageProps) {
    // Admin only — ACCESS_CONTROL.md. This page used requireAuth, so every
    // signed-in user could open the approval queue and read what staff and
    // supervisors had proposed, along with the before-and-after of each
    // record. A supervisor seeing it in production is what prompted writing
    // the access rules down.
    const access = await pageAccess(["admin"]);
    if (!access.allowed) {
        return (
            <NoAccess
                role={access.role}
                what="the edit request queue"
                who="an administrator"
            />
        );
    }

    const { session } = access;
    const { role, user } = session;
    const canApprove = true;
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "3m");

    // Dated by when the request was raised, but anything still pending stays
    // on the list however old it is — an unanswered request must not be able
    // to scroll out of the admin's view.
    const editRequests = await prisma.editRequest.findMany({
        where: {
            // Scoped by organisation: listing, the sidebar badge and approval
            // all used to reach across every organisation in the database.
            organizationId: session.organizationId,
            OR: [
                { createdAt: { gte: dateRange.from, lte: dateRange.to } },
                { status: "pending" },
            ],
        },
        include: {
            requestedBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            approvedBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title="Edit Requests"
                    description={`Requests from staff and supervisors — ${dateRange.label}`}
                />
                <PagePeriodSelector defaultPreset="3m" />
            </div>
            <EditRequestsTable
                editRequests={editRequests}
                role={role}
                currentUserId={user.id}
                canApprove={canApprove}
            />
        </div>
    );
}
