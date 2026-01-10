import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    TrendingUp,
    TrendingDown,
    Truck,
    Users,
    DollarSign,
    Package,
    Route,
    Receipt,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default async function ReportsPage() {
    const session = await requireRole(["admin"]);
    const { organizationId } = session;

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Fleet Summary
    const [
        totalTrucks,
        activeTrucks,
        totalDrivers,
        activeDrivers,
    ] = await Promise.all([
        prisma.truck.count({ where: { organizationId } }),
        prisma.truck.count({ where: { organizationId, status: "active" } }),
        prisma.driver.count({ where: { organizationId } }),
        prisma.driver.count({ where: { organizationId, status: "active" } }),
    ]);

    // Trip Statistics
    const [
        thisMonthTrips,
        lastMonthTrips,
        completedTrips,
        inProgressTrips,
    ] = await Promise.all([
        prisma.trip.count({
            where: {
                organizationId,
                scheduledDate: { gte: thisMonthStart, lte: thisMonthEnd },
            },
        }),
        prisma.trip.count({
            where: {
                organizationId,
                scheduledDate: { gte: lastMonthStart, lte: lastMonthEnd },
            },
        }),
        prisma.trip.count({
            where: { organizationId, status: "completed" },
        }),
        prisma.trip.count({
            where: { organizationId, status: "in_progress" },
        }),
    ]);

    // Financial Summary
    const [
        thisMonthInvoices,
        lastMonthInvoices,
        thisMonthPayments,
        lastMonthPayments,
        thisMonthExpenses,
        lastMonthExpenses,
    ] = await Promise.all([
        prisma.invoice.aggregate({
            where: {
                organizationId,
                issueDate: { gte: thisMonthStart, lte: thisMonthEnd },
            },
            _sum: { total: true },
        }),
        prisma.invoice.aggregate({
            where: {
                organizationId,
                issueDate: { gte: lastMonthStart, lte: lastMonthEnd },
            },
            _sum: { total: true },
        }),
        prisma.payment.aggregate({
            where: {
                invoice: { organizationId },
                paymentDate: { gte: thisMonthStart, lte: thisMonthEnd },
            },
            _sum: { amount: true },
        }),
        prisma.payment.aggregate({
            where: {
                invoice: { organizationId },
                paymentDate: { gte: lastMonthStart, lte: lastMonthEnd },
            },
            _sum: { amount: true },
        }),
        prisma.expense.aggregate({
            where: {
                organizationId,
                date: { gte: thisMonthStart, lte: thisMonthEnd },
            },
            _sum: { amount: true },
        }),
        prisma.expense.aggregate({
            where: {
                organizationId,
                date: { gte: lastMonthStart, lte: lastMonthEnd },
            },
            _sum: { amount: true },
        }),
    ]);

    // Outstanding invoices
    const outstandingInvoices = await prisma.invoice.findMany({
        where: {
            organizationId,
            status: { in: ["draft", "sent"] },
        },
        include: {
            customer: { select: { name: true } },
            payments: { select: { amount: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
    });

    // Top customers by revenue
    const topCustomers = await prisma.customer.findMany({
        where: { organizationId },
        include: {
            invoices: {
                where: {
                    issueDate: { gte: thisMonthStart, lte: thisMonthEnd },
                },
                select: { total: true },
            },
        },
        take: 10,
    });

    const topCustomersByRevenue = topCustomers
        .map((customer) => ({
            ...customer,
            revenue: customer.invoices.reduce((sum, inv) => sum + inv.total, 0),
        }))
        .filter((c) => c.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Expense by category
    const expensesByCategory = await prisma.expense.groupBy({
        by: ["categoryId"],
        where: {
            organizationId,
            date: { gte: thisMonthStart, lte: thisMonthEnd },
        },
        _sum: { amount: true },
    });

    const categories = await prisma.expenseCategory.findMany({
        where: {
            id: { in: expensesByCategory.map((e) => e.categoryId) },
        },
    });

    const expensesWithCategories = expensesByCategory
        .map((expense) => ({
            category: categories.find((c) => c.id === expense.categoryId)?.name || "Unknown",
            amount: expense._sum.amount || 0,
        }))
        .sort((a, b) => b.amount - a.amount);

    // Helper for change percentage
    const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const thisMonthInvoiceTotal = thisMonthInvoices._sum?.total || 0;
    const lastMonthInvoiceTotal = lastMonthInvoices._sum?.total || 0;
    const invoiceChange = calcChange(thisMonthInvoiceTotal, lastMonthInvoiceTotal);

    const thisMonthPaymentTotal = thisMonthPayments._sum?.amount || 0;
    const lastMonthPaymentTotal = lastMonthPayments._sum?.amount || 0;
    const paymentChange = calcChange(thisMonthPaymentTotal, lastMonthPaymentTotal);

    const thisMonthExpenseTotal = thisMonthExpenses._sum?.amount || 0;
    const lastMonthExpenseTotal = lastMonthExpenses._sum?.amount || 0;
    const expenseChange = calcChange(thisMonthExpenseTotal, lastMonthExpenseTotal);

    const tripChange = calcChange(thisMonthTrips, lastMonthTrips);

    return (
        <div>
            <PageHeader
                title="Reports"
                description={`Reports for ${format(now, "MMMM yyyy")}`}
            />

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="financial">Financial</TabsTrigger>
                    <TabsTrigger value="fleet">Fleet</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    ${thisMonthInvoiceTotal.toLocaleString()}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    {invoiceChange >= 0 ? (
                                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                                    ) : (
                                        <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                                    )}
                                    <span className={invoiceChange >= 0 ? "text-green-500" : "text-red-500"}>
                                        {invoiceChange >= 0 ? "+" : ""}
                                        {invoiceChange}%
                                    </span>
                                    <span className="ml-1">vs last month</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Collections</CardTitle>
                                <Receipt className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    ${thisMonthPaymentTotal.toLocaleString()}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    {paymentChange >= 0 ? (
                                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                                    ) : (
                                        <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                                    )}
                                    <span className={paymentChange >= 0 ? "text-green-500" : "text-red-500"}>
                                        {paymentChange >= 0 ? "+" : ""}
                                        {paymentChange}%
                                    </span>
                                    <span className="ml-1">vs last month</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    ${thisMonthExpenseTotal.toLocaleString()}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    {expenseChange <= 0 ? (
                                        <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
                                    ) : (
                                        <TrendingUp className="mr-1 h-3 w-3 text-red-500" />
                                    )}
                                    <span className={expenseChange <= 0 ? "text-green-500" : "text-red-500"}>
                                        {expenseChange >= 0 ? "+" : ""}
                                        {expenseChange}%
                                    </span>
                                    <span className="ml-1">vs last month</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Trips</CardTitle>
                                <Route className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{thisMonthTrips}</div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    {tripChange >= 0 ? (
                                        <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                                    ) : (
                                        <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                                    )}
                                    <span className={tripChange >= 0 ? "text-green-500" : "text-red-500"}>
                                        {tripChange >= 0 ? "+" : ""}
                                        {tripChange}%
                                    </span>
                                    <span className="ml-1">vs last month</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Customers by Revenue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {topCustomersByRevenue.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">
                                        No revenue this month
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {topCustomersByRevenue.map((customer) => (
                                            <div
                                                key={customer.id}
                                                className="flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="font-medium">{customer.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {customer.invoices.length} invoice(s)
                                                    </p>
                                                </div>
                                                <p className="font-bold">${customer.revenue.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Expenses by Category</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {expensesWithCategories.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">
                                        No expenses this month
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {expensesWithCategories.map((expense, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <p className="font-medium">{expense.category}</p>
                                                <p className="font-bold">${expense.amount.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="financial" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Net Profit (This Month)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-3xl font-bold ${thisMonthPaymentTotal - thisMonthExpenseTotal >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                        }`}
                                >
                                    ${(thisMonthPaymentTotal - thisMonthExpenseTotal).toLocaleString()}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    Collections: ${thisMonthPaymentTotal.toLocaleString()}
                                    <br />
                                    Expenses: ${thisMonthExpenseTotal.toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Outstanding Invoices</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-amber-600">
                                    $
                                    {outstandingInvoices
                                        .reduce((sum, inv) => {
                                            const paid = inv.payments.reduce((p, pay) => p + pay.amount, 0);
                                            return sum + (inv.total - paid);
                                        }, 0)
                                        .toLocaleString()}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {outstandingInvoices.length} invoice(s) pending
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Collection Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">
                                    {thisMonthInvoiceTotal > 0
                                        ? Math.round((thisMonthPaymentTotal / thisMonthInvoiceTotal) * 100)
                                        : 0}
                                    %
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    of invoiced amount collected
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Outstanding Invoices</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {outstandingInvoices.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">
                                    No outstanding invoices
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {outstandingInvoices.map((invoice) => {
                                        const paid = invoice.payments.reduce((p, pay) => p + pay.amount, 0);
                                        const balance = invoice.total - paid;
                                        const isOverdue = invoice.dueDate < now;

                                        return (
                                            <div
                                                key={invoice.id}
                                                className="flex items-center justify-between p-3 rounded-lg border"
                                            >
                                                <div>
                                                    <p className="font-medium">{invoice.invoiceNumber}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {invoice.customer.name}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">${balance.toLocaleString()}</p>
                                                    <p
                                                        className={`text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"
                                                            }`}
                                                    >
                                                        {isOverdue ? "Overdue: " : "Due: "}
                                                        {format(invoice.dueDate, "MMM d, yyyy")}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fleet" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
                                <Truck className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalTrucks}</div>
                                <p className="text-xs text-muted-foreground">
                                    {activeTrucks} available
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalDrivers}</div>
                                <p className="text-xs text-muted-foreground">
                                    {activeDrivers} available
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Completed Trips</CardTitle>
                                <Route className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{completedTrips}</div>
                                <p className="text-xs text-muted-foreground">all time</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
                                <Route className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{inProgressTrips}</div>
                                <p className="text-xs text-muted-foreground">in progress</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fleet Utilization</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Truck Utilization</span>
                                            <span>
                                                {totalTrucks > 0
                                                    ? Math.round(((totalTrucks - activeTrucks) / totalTrucks) * 100)
                                                    : 0}
                                                %
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted">
                                            <div
                                                className="h-2 rounded-full bg-primary"
                                                style={{
                                                    width: `${totalTrucks > 0 ? ((totalTrucks - activeTrucks) / totalTrucks) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {totalTrucks - activeTrucks} trucks in use
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Driver Utilization</span>
                                            <span>
                                                {totalDrivers > 0
                                                    ? Math.round(
                                                        ((totalDrivers - activeDrivers) / totalDrivers) * 100
                                                    )
                                                    : 0}
                                                %
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted">
                                            <div
                                                className="h-2 rounded-full bg-primary"
                                                style={{
                                                    width: `${totalDrivers > 0 ? ((totalDrivers - activeDrivers) / totalDrivers) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {totalDrivers - activeDrivers} drivers on trip
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Trip Statistics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">This Month</span>
                                        <span className="font-bold">{thisMonthTrips} trips</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Last Month</span>
                                        <span className="font-bold">{lastMonthTrips} trips</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Change</span>
                                        <span
                                            className={`font-bold ${tripChange >= 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                            {tripChange >= 0 ? "+" : ""}
                                            {tripChange}%
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
