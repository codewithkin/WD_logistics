import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EditRequestsTable } from "./_components/edit-requests-table";

export default async function EditRequestsPage() {
    const session = await requireAuth();
    const { role, organizationId, userId } = session;

    const isStaff = role === "staff";

    const editRequests = await prisma.editRequest.findMany({
        where: {
            organizationId,
            ...(isStaff ? { requestedById: userId } : {}),
        },
        include: {
            requestedBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            reviewedBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div>
            <PageHeader
                title="Edit Requests"
                description={
                    isStaff
                        ? "View your edit requests and their status"
                        : "Review and manage edit requests from staff"
                }
            />
            <EditRequestsTable editRequests={editRequests} role={role} />
        </div>
    );
}
