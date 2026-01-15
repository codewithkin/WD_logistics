import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsClient } from "@/components/reports/reports-client";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { ReportsPeriodSelector } from "./_components/reports-period-selector";

interface ReportsPageProps {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  // Get date range from URL params
  const dateRange = getDateRangeFromParams(params, "1m");
  const periodStart = dateRange.from;
  const periodEnd = dateRange.to;

  // Calculate comparison period (same duration, previous period)
  const periodDuration = periodEnd.getTime() - periodStart.getTime();
  const comparisonEnd = new Date(periodStart.getTime() - 1);
  const comparisonStart = new Date(comparisonEnd.getTime() - periodDuration);

  // Fleet Summary
  const [totalTrucks, activeTrucks, totalDrivers, activeDrivers] =
    await Promise.all([
      prisma.truck.count({ where: { organizationId } }),
      prisma.truck.count({ where: { organizationId, status: "active" } }),
      prisma.driver.count({ where: { organizationId } }),
      prisma.driver.count({ where: { organizationId, status: "active" } }),
    ]);

  // Trip Statistics
  const [thisMonthTrips, lastMonthTrips, completedTrips, inProgressTrips] =
    await Promise.all([
      prisma.trip.count({
        where: {
          organizationId,
          scheduledDate: { gte: periodStart, lte: periodEnd },
        },
      }),
      prisma.trip.count({
        where: {
          organizationId,
          scheduledDate: { gte: comparisonStart, lte: comparisonEnd },
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
        issueDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId,
        issueDate: { gte: comparisonStart, lte: comparisonEnd },
      },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: {
        invoice: { organizationId },
        paymentDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        invoice: { organizationId },
        paymentDate: { gte: comparisonStart, lte: comparisonEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        organizationId,
        date: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        organizationId,
        date: { gte: comparisonStart, lte: comparisonEnd },
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

  // Top customers by revenue (within selected period)
  const topCustomers = await prisma.customer.findMany({
    where: { organizationId },
    include: {
      invoices: {
        where: {
          issueDate: { gte: periodStart, lte: periodEnd },
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

  // Expense by category (within selected period)
  const expensesByCategory = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: {
      organizationId,
      date: { gte: periodStart, lte: periodEnd },
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
      category:
        categories.find((c) => c.id === expense.categoryId)?.name || "Unknown",
      amount: expense._sum.amount || 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Get data for report generator
  const [customers, trucks, reports] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.truck.findMany({
      where: { organizationId, status: "active" },
      select: { id: true, registrationNo: true, make: true, model: true },
      orderBy: { registrationNo: "asc" },
    }),
    prisma.report.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const dashboardData = {
    totalTrucks,
    activeTrucks,
    totalDrivers,
    activeDrivers,
    thisMonthTrips,
    lastMonthTrips,
    completedTrips,
    inProgressTrips,
    thisMonthInvoiceTotal: thisMonthInvoices._sum?.total || 0,
    lastMonthInvoiceTotal: lastMonthInvoices._sum?.total || 0,
    thisMonthPaymentTotal: thisMonthPayments._sum?.amount || 0,
    lastMonthPaymentTotal: lastMonthPayments._sum?.amount || 0,
    thisMonthExpenseTotal: thisMonthExpenses._sum?.amount || 0,
    lastMonthExpenseTotal: lastMonthExpenses._sum?.amount || 0,
    outstandingInvoices,
    topCustomersByRevenue,
    expensesWithCategories,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Reports"
          description={`Reports for ${dateRange.label}`}
        />
        <ReportsPeriodSelector />
      </div>

      <ReportsClient
        customers={customers}
        trucks={trucks}
        initialReports={reports}
        dashboardContent={<ReportsDashboard data={dashboardData} />}
      />
    </div>
  );
}
