import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TrailersTable } from "./_components/trailers-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function TrailersPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const trailers = await prisma.trailer.findMany({
        where: { organizationId },
        include: {
            assignedTruck: {
                select: { id: true, registrationNo: true },
            },
        },
        orderBy: { registrationNo: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Trailers"
                    description="Manage your fleet of trailers"
                />
                {canCreate && (
                    <Link href="/fleet/trailers/new" prefetch className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Trailer
                        </Button>
                    </Link>
                )}
            </div>
            <TrailersTable trailers={trailers} role={role} />
        </div>
    );
}
