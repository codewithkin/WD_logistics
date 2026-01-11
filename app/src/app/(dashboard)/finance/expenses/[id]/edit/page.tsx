import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../../_components/expense-form";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

interface EditExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
    const { id } = await params;
    const user = await requireRole(["admin", "supervisor", "staff"]);

    const [expense, categories, trucks, trips] = await Promise.all([
        prisma.expense.findUnique({
            where: {
                id,
                organizationId: user.organizationId,
            },
            include: {
                truckExpenses: {
                    select: {
                        truckId: true,
                    },
                },
                tripExpenses: {
                    select: {
                        tripId: true,
                    },
                },
            },
        }),
        prisma.expenseCategory.findMany({
            where: {
                organizationId: user.organizationId,
            },
            select: {
                id: true,
                name: true,
                isTruck: true,
                isTrip: true,
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
    ]);

    if (!expense) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Edit Expense"
                description="Update expense details"
            />
            <div className="max-w-2xl">
                <ExpenseForm
                    categories={categories}
                    trucks={trucks}
                    trips={trips}
                    expense={expense}
                />
            </div>
        </div>
    );
}
