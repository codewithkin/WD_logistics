import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { EditRequestsTable } from "./_components/edit-requests-table";

interface EditRequestsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function EditRequestsPage({ searchParams }: EditRequestsPageProps) {
    const session = await requireAuth();
    const { role, user } = session;
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "3m");

    const isStaff = role === "staff";

    // Dated by when the request was raised, but anything still pending stays
    // on the list however old it is — an unanswered request must not be able
    // to scroll out of the admin's view.
    const editRequests = await prisma.editRequest.findMany({
        where: {
            ...(isStaff ? { requestedById: user.id } : {}),
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
                    description={
                        isStaff
                            ? `Your edit requests and their status — ${dateRange.label}`
                            : `Requests from staff and supervisors — ${dateRange.label}`
                    }
                />
                <PagePeriodSelector defaultPreset="3m" />
            </div>
            <EditRequestsTable editRequests={editRequests} role={role} />
        </div>
    );
}
