import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardStats } from "./_components/dashboard-stats";
import { OverdueInvoices } from "./_components/overdue-invoices";
import { RevenueExpensesChart } from "@/components/dashboard/revenue-expenses-chart";
import { getRevenueExpensesData } from "@/lib/dashboard/revenue-expenses";
import { PerformanceTrendChart } from "@/components/dashboard/performance-trend-chart";
import { getPerformanceTrendData } from "@/lib/dashboard/performance-trend";
import { DriverPerformanceTable } from "@/components/dashboard/driver-performance-table";
import { getDriverPerformanceData } from "@/lib/dashboard/driver-performance";
import { QuickActions } from "./_components/quick-actions";
import { DashboardPeriodSelector } from "./_components/dashboard-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { canViewFinancialData } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    // Fetch dashboard data
    const [
        truckStats,
        tripStats,
        revenueStats,
        overdueInvoices,
        revenueExpensesData,
        performanceTrendData,
        driverPerformanceData,
        periodPayments,
        periodExpenses,
    ] = await Promise.all([
        // Truck stats
        prisma.truck.groupBy({
            by: ["status"],
            where: { organizationId },
            _count: true,
        }),
        // Trip stats within period
        prisma.trip.count({
            where: {
                organizationId,
                scheduledDate: {
                    gte: dateRange.from,
                    lte: dateRange.to,
                },
            },
        }),
        // Revenue within period
        prisma.trip.aggregate({
            where: {
                organizationId,
                status: "completed",
                endDate: {
                    gte: dateRange.from,
                    lte: dateRange.to,
                },
            },
            _sum: { revenue: true },
        }),
        // Overdue invoices
        prisma.invoice.findMany({
            where: {
                organizationId,
                status: "overdue",
            },
            include: {
                customer: true,
            },
            take: 5,
        }),
        // Revenue vs Expenses data (monthly breakdown for chart)
        getRevenueExpensesData(dateRange.from, dateRange.to),
        // Performance trend data (monthly breakdown for chart)
        getPerformanceTrendData(dateRange.from, dateRange.to),
        // Driver performance data
        getDriverPerformanceData(dateRange.from, dateRange.to),
        // Period totals: Payments (revenue) within exact date range
        prisma.payment.aggregate({
            where: {
                invoice: { organizationId },
                paymentDate: {
                    gte: dateRange.from,
                    lte: dateRange.to,
                },
            },
            _sum: { amount: true },
        }),
        // Period totals: Expenses within exact date range
        prisma.expense.aggregate({
            where: {
                organizationId,
                date: {
                    gte: dateRange.from,
                    lte: dateRange.to,
                },
            },
            _sum: { amount: true },
        }),
    ]);

    // Calculate exact period totals for charts
    const periodTotals = {
        revenue: periodPayments._sum.amount || 0,
        expenses: periodExpenses._sum.amount || 0,
        trips: tripStats,
    };

    // Calculate fleet status
    const fleetStatus = {
        active: truckStats.find((s) => s.status === "active")?._count || 0,
        inService: truckStats.find((s) => s.status === "in_service")?._count || 0,
        inRepair: truckStats.find((s) => s.status === "in_repair")?._count || 0,
        inactive: truckStats.find((s) => s.status === "inactive")?._count || 0,
    };

    const totalTrucks = Object.values(fleetStatus).reduce((a, b) => a + b, 0);

    const stats = {
        activeTrucks: fleetStatus.active,
        totalTrucks,
        tripsThisMonth: tripStats,
        revenueThisMonth: revenueStats._sum.revenue || 0,
        overdueInvoicesCount: overdueInvoices.length,
        periodLabel: dateRange.label,
    };

    const showFinancials = canViewFinancialData(role);

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title="Dashboard"
                    description={`Welcome back, ${session.user.name}`}
                />
                <div className="flex items-center gap-3">
                    <DashboardPeriodSelector />
                    <QuickActions role={role} />
                </div>
            </div>

            {/* Stats Cards */}
            <DashboardStats stats={stats} role={role} showFinancials={showFinancials} />

            {/* Revenue vs Expenses Chart - Admin Only */}
            {showFinancials && (
                <div className="mt-6">
                    <RevenueExpensesChart
                        data={revenueExpensesData}
                        periodLabel={dateRange.label}
                        periodTotals={{ revenue: periodTotals.revenue, expenses: periodTotals.expenses }}
                    />
                </div>
            )}

            {/* Performance Trend Chart - Admin Only */}
            {showFinancials && (
                <div className="mt-6">
                    <PerformanceTrendChart
                        data={performanceTrendData}
                        periodLabel={dateRange.label}
                        periodTotals={periodTotals}
                    />
                </div>
            )}

            {/* Driver Performance Table - Admin Only */}
            {showFinancials && (
                <div className="mt-6">
                    <DriverPerformanceTable data={driverPerformanceData} periodLabel={dateRange.label} />
                </div>
            )}

            {/* Admin Only: Overdue Invoices */}
            {role === "admin" && overdueInvoices.length > 0 && (
                <div className="mt-6">
                    <OverdueInvoices invoices={overdueInvoices} />
                </div>
            )}
        </div>
    );
}
