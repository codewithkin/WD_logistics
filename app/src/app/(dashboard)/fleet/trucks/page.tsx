import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TrucksTable } from "./_components/trucks-table";
import { Plus } from "lucide-react";

export default async function TrucksPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const trucks = await prisma.truck.findMany({
        where: { organizationId },
        include: {
            assignedDriver: true,
            truckExpenses: {
                include: {
                    expense: true,
                },
            },
            trips: {
                select: {
                    revenue: true,
                },
            },
            _count: {
                select: {
                    trips: true,
                },
            },
        },
        orderBy: { registrationNo: "asc" },
    });

    // Transform data to include calculated totals
    const trucksWithTotals = trucks.map((truck) => ({
        ...truck,
        totalExpenses: truck.truckExpenses.reduce((sum, te) => sum + te.expense.amount, 0),
        totalRevenue: truck.trips.reduce((sum, t) => sum + t.revenue, 0),
    }));

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Trucks"
                description="Manage your fleet of trucks"
                action={
                    canCreate
                        ? {
                            label: "Add Truck",
                            href: "/fleet/trucks/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <TrucksTable trucks={trucksWithTotals} role={role} />
        </div>
    );
}
