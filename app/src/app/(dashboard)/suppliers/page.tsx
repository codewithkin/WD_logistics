import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SuppliersTable } from "./_components/suppliers-table";
import { SupplierCards } from "./_components/supplier-cards";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SuppliersPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    // Get suppliers with period-filtered expenses
    const suppliers = await prisma.supplier.findMany({
        where: { organizationId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            contactPerson: true,
            status: true,
            balance: true,
            expenses: {
                where: {
                    date: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
                },
                select: { id: true, amount: true },
            },
        },
        orderBy: { name: "asc" },
    });

    // Transform data to include period-specific counts and totals
    const suppliersWithCounts = suppliers.map((supplier) => {
        const periodExpenseCount = supplier.expenses.length;
        const periodExpenseTotal = supplier.expenses.reduce((sum, exp) => sum + exp.amount, 0);

        return {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            contactPerson: supplier.contactPerson,
            status: supplier.status,
            balance: supplier.balance,
            periodExpenseTotal,
            _count: {
                expenses: periodExpenseCount,
            },
        };
    });

    // Calculate totals for cards (using period-filtered data)
    const totalOwing = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const activeSuppliers = suppliers.filter((s) => s.status === "active").length;
    const suppliersWithOwing = suppliers.filter((s) => s.balance > 0).length;
    const periodTotalExpenses = suppliersWithCounts.reduce((sum, s) => sum + s.periodExpenseTotal, 0);

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Suppliers"
                    description={`Manage your suppliers and track amounts owed - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="1m" />
                    {canCreate && (
                        <Link href="/suppliers/new" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Supplier
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <SupplierCards
                totalSuppliers={suppliers.length}
                activeSuppliers={activeSuppliers}
                totalOwing={totalOwing}
                suppliersWithOwing={suppliersWithOwing}
                periodTotalExpenses={periodTotalExpenses}
                periodLabel={dateRange.label}
            />
            <SuppliersTable suppliers={suppliersWithCounts} role={role} periodLabel={dateRange.label} />
        </div>
    );
}
