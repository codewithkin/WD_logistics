import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { CustomersTable } from "./_components/customers-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CustomersPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    // Get customers with period-filtered counts
    const customers = await prisma.customer.findMany({
        where: { organizationId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            balance: true,
            trips: {
                where: {
                    scheduledDate: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
                },
                select: { id: true, revenue: true },
            },
            invoices: {
                where: {
                    issueDate: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
                },
                select: { id: true, total: true, status: true },
            },
        },
        orderBy: { name: "asc" },
    });

    // Transform data to include counts and period-specific balance
    const customersWithCounts = customers.map((customer) => {
        const periodRevenue = customer.invoices.reduce((sum, inv) => sum + inv.total, 0);
        const periodTrips = customer.trips.length;
        const periodInvoices = customer.invoices.length;

        return {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            status: customer.status,
            balance: customer.balance,
            periodRevenue,
            _count: {
                trips: periodTrips,
                invoices: periodInvoices,
            },
        };
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Customers"
                    description={`Manage your customers and clients - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="1m" />
                    {canCreate && (
                        <Link href="/customers/new" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Customer
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <CustomersTable customers={customersWithCounts} role={role} periodLabel={dateRange.label} />
        </div>
    );
}
