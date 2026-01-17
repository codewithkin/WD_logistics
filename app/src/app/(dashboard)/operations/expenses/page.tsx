import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpensesClient } from "./_components/expenses-client";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { canViewExpensesPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

interface ExpensesPageProps {
    searchParams: Promise<{ tripId?: string; categoryId?: string; period?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Check if user can view expenses page
    if (!canViewExpensesPage(role)) {
        redirect("/dashboard");
    }

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    const whereClause: Record<string, unknown> = {
        organizationId,
        date: {
            gte: dateRange.from,
            lte: dateRange.to,
        },
    };

    // Filter by trip if specified
    if (params.tripId) {
        whereClause.tripExpenses = {
            some: { tripId: params.tripId }
        };
    }

    // Fetch expense categories for tabs
    const categories = await prisma.expenseCategory.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
    });

    const expenses = await prisma.expense.findMany({
        where: whereClause,
        include: {
            category: true,
            tripExpenses: {
                include: {
                    trip: {
                        include: {
                            truck: true,
                            driver: true,
                        },
                    },
                },
            },
        },
        orderBy: { date: "desc" },
    });

    // Calculate analytics
    const totalExpenses = expenses.length;
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    // Note: Expense model doesn't have status field, so we set these to defaults
    const pendingExpenses = 0;
    const approvedExpenses = 0;
    const rejectedExpenses = 0;
    const paidExpenses = totalExpenses; // Assume all are paid
    const pendingAmount = 0;
    const paidAmount = totalAmount;

    // Get category breakdown
    const categoryBreakdown = expenses.reduce((acc, e) => {
        const catName = e.category?.name || "Uncategorized";
        if (!acc[catName]) {
            acc[catName] = { name: catName, count: 0, amount: 0 };
        }
        acc[catName].count += 1;
        acc[catName].amount += e.amount;
        return acc;
    }, {} as Record<string, { name: string; count: number; amount: number }>);

    const analytics = {
        totalExpenses,
        totalAmount,
        pendingExpenses,
        approvedExpenses,
        rejectedExpenses,
        paidExpenses,
        pendingAmount,
        paidAmount,
        categoryBreakdown: Object.values(categoryBreakdown),
    };

    const canCreate = role === "admin" || role === "supervisor";
    const canExport = role === "admin";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Expenses"
                    description={`Track and manage expenses - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="1m" />
                    {canCreate && (
                        <Link href="/operations/expenses/new" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Expense
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <ExpensesClient
                expenses={expenses}
                categories={categories}
                analytics={analytics}
                role={role}
                canExport={canExport}
                periodLabel={dateRange.label}
            />
        </div>
    );
}
