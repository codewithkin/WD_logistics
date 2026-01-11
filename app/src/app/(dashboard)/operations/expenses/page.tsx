import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpensesTable } from "./_components/expenses-table";
import { ExpensesAnalytics } from "./_components/expenses-analytics";
import { Plus } from "lucide-react";

interface ExpensesPageProps {
    searchParams: Promise<{ tripId?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const whereClause: Record<string, unknown> = { organizationId };

    // Filter by trip if specified
    if (params.tripId) {
        whereClause.tripExpenses = {
            some: { tripId: params.tripId }
        };
    }

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
    const pendingExpenses = expenses.filter(e => e.status === "pending").length;
    const approvedExpenses = expenses.filter(e => e.status === "approved").length;
    const rejectedExpenses = expenses.filter(e => e.status === "rejected").length;
    const paidExpenses = expenses.filter(e => e.status === "paid").length;
    const pendingAmount = expenses.filter(e => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);
    const paidAmount = expenses.filter(e => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);

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
            <PageHeader
                title="Expenses"
                description="Track and manage expenses"
                action={
                    canCreate
                        ? {
                            label: "Add Expense",
                            href: "/operations/expenses/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <ExpensesAnalytics analytics={analytics} expenses={expenses} canExport={canExport} />
            <ExpensesTable expenses={expenses} role={role} />
        </div>
    );
}
