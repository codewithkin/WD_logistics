import { PageHeader } from "@/components/layout/page-header";
import { ExpensesOverview } from "./_components/expenses-overview";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function ExpensesPage() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    // Fetch categories
    const categories = await prisma.expenseCategory.findMany({
        where: { organizationId: user.organizationId },
        include: {
            _count: {
                select: { expenses: true },
            },
        },
        orderBy: { name: "asc" },
    });

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
        where: {
            organizationId: user.organizationId,
        },
        include: {
            category: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            },
            truckExpenses: {
                include: {
                    truck: {
                        select: {
                            registrationNo: true,
                        },
                    },
                },
            },
            tripExpenses: {
                include: {
                    trip: {
                        select: {
                            originCity: true,
                            destinationCity: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            date: "desc",
        },
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expenses"
                description="Track and manage all business expenses"
            />
            <ExpensesOverview categories={categories} expenses={expenses} />
