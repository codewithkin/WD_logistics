import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardStats } from "./_components/dashboard-stats";
import { RecentTrips } from "./_components/recent-trips";
import { PendingEditRequests } from "./_components/pending-edit-requests";
import { FleetStatus } from "./_components/fleet-status";
import { OverdueInvoices } from "./_components/overdue-invoices";
import { RevenueExpensesChart } from "@/components/dashboard/revenue-expenses-chart";
import { getRevenueExpensesData } from "@/lib/dashboard/revenue-expenses";
import { FleetUtilizationChart } from "@/components/dashboard/fleet-utilization-chart";
import { getFleetUtilizationData } from "@/lib/dashboard/fleet-utilization";

export default async function DashboardPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Fetch dashboard data
    const [
        truckStats,
        tripStats,
        revenueStats,
        pendingRequests,
        recentTrips,
        overdueInvoices,
        revenueExpensesData,
        fleetUtilizationData,
    ] = await Promise.all([
        // Truck stats
        prisma.truck.groupBy({
            by: ["status"],
            where: { organizationId },
            _count: true,
        }),
        // Trip stats this month
        prisma.trip.count({
            where: {
                organizationId,
                scheduledDate: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
            },
        }),
        // Revenue this month
        prisma.trip.aggregate({
            where: {
                organizationId,
                status: "completed",
                endDate: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
            },
            _sum: { revenue: true },
        }),
        // Pending edit requests
        prisma.editRequest.count({
            where: { status: "pending" },
        }),
        // Recent trips
        prisma.trip.findMany({
            where: { organizationId },
            include: {
                truck: true,
                driver: true,
                customer: true,
            },
            orderBy: { scheduledDate: "desc" },
            take: 5,
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
        // Revenue vs Expenses data
        getRevenueExpensesData(),
        // Fleet utilization data
        getFleetUtilizationData(),
    ]);

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
        pendingEditRequests: pendingRequests,
        overdueInvoicesCount: overdueInvoices.length,
    };

    return (
        <div>
            <PageHeader
                title="Dashboard"
                description={`Welcome back, ${session.user.name}`}
            />

            {/* Stats Cards */}
            <DashboardStats stats={stats} role={role} />

            {/* Revenue vs Expenses Chart - Full Width */}
            <div className="mt-6">
                <RevenueExpensesChart data={revenueExpensesData} />
            </div>

            {/* Fleet Utilization Chart - Full Width */}
            <div className="mt-6">
                <FleetUtilizationChart data={fleetUtilizationData} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Recent Trips */}
                <RecentTrips trips={recentTrips} />

                {/* Fleet Status */}
                <FleetStatus fleetStatus={fleetStatus} />

                {/* Admin/Supervisor Only: Pending Edit Requests */}
                {(role === "admin" || role === "supervisor") && pendingRequests > 0 && (
                    <PendingEditRequests count={pendingRequests} />
                )}

                {/* Admin Only: Overdue Invoices */}
                {role === "admin" && overdueInvoices.length > 0 && (
                    <OverdueInvoices invoices={overdueInvoices} />
                )}
            </div>
        </div>
    );
}
