import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { TrailersTable } from "./_components/trailers-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrailersPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function TrailersPage({ searchParams }: TrailersPageProps) {
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="the trailer list" />;
    }
    const session = access.session;
    const { role, organizationId } = session;
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "1y");

    // Trailers are dated by when they joined the fleet. A trailer that is
    // still in service stays on the list whatever the period, so a short
    // window doesn't hide the working fleet.
    const trailers = await prisma.trailer.findMany({
        where: {
            organizationId,
            OR: [
                { createdAt: { gte: dateRange.from, lte: dateRange.to } },
                { status: { not: "decommissioned" } },
            ],
        },
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
                    description={`Fleet of trailers — ${dateRange.label}`}
                />
                <div className="flex items-center gap-2">
                <PagePeriodSelector defaultPreset="1y" />
                {canCreate && (
                    <Link href="/fleet/trailers/new" prefetch className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Trailer
                        </Button>
                    </Link>
                )}
                </div>
            </div>
            <TrailersTable trailers={trailers} role={role} />
        </div>
    );
}
