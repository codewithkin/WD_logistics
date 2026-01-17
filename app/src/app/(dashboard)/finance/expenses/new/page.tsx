import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../_components/expense-form";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { canViewExpensesPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

interface NewExpensePageProps {
    searchParams: Promise<{
        tripId?: string;
        truckId?: string;
        driverId?: string;
        supplier?: string;
        business?: string;
    }>;
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
    const user = await requireRole(["admin", "supervisor"]);
    const params = await searchParams;

    // Check if user can view expenses page
    if (!canViewExpensesPage(user.role)) {
        redirect("/dashboard");
    }

    const [categories, trucks, trips, drivers, suppliers] = await Promise.all([
        prisma.expenseCategory.findMany({
            where: {
                organizationId: user.organizationId,
            },
            select: {
                id: true,
                name: true,
                isTruck: true,
                isTrip: true,
                isDriver: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
        prisma.truck.findMany({
            where: {
                organizationId: user.organizationId,
                status: { in: ["active", "in_service"] },
            },
            select: {
                id: true,
                registrationNo: true,
                make: true,
                model: true,
            },
            orderBy: {
                registrationNo: "asc",
            },
        }),
        prisma.trip.findMany({
            where: {
                organizationId: user.organizationId,
                status: { in: ["scheduled", "in_progress", "completed"] },
                scheduledDate: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
            },
            select: {
                id: true,
                originCity: true,
                destinationCity: true,
                scheduledDate: true,
                truck: {
                    select: {
                        registrationNo: true,
                    },
                },
                driver: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: {
                scheduledDate: "desc",
            },
        }),
        prisma.driver.findMany({
            where: {
                organizationId: user.organizationId,
                status: "active",
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                licenseNumber: true,
            },
            orderBy: {
                firstName: "asc",
            },
        }),
        prisma.supplier.findMany({
            where: {
                organizationId: user.organizationId,
                status: "active",
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
    ]);

    // Parse prefilled values from search params
    const prefilledTripId = params.tripId || undefined;
    const prefilledTruckId = params.truckId || undefined;
    const prefilledDriverId = params.driverId || undefined;
    const prefilledSupplierId = params.supplier || undefined;
    const prefilledIsBusinessExpense = params.business === "true";

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Add Expense"
                description="Record a new business expense"
            />
            <div className="w-full">
                <ExpenseForm
                    categories={categories}
                    trucks={trucks}
                    trips={trips}
                    drivers={drivers}
                    suppliers={suppliers}
                    prefilledTripId={prefilledTripId}
                    prefilledTruckId={prefilledTruckId}
                    prefilledDriverId={prefilledDriverId}
                    prefilledSupplierId={prefilledSupplierId}
                    prefilledIsBusinessExpense={prefilledIsBusinessExpense}
                />
            </div>
        </div>
    );
}
