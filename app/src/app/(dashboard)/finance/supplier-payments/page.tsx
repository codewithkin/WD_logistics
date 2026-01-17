import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierPaymentsTable } from "./_components/supplier-payments-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SupplierPaymentsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function SupplierPaymentsPage({ searchParams }: SupplierPaymentsPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    const payments = await prisma.supplierPayment.findMany({
        where: {
            organizationId,
            paymentDate: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
        },
        include: {
            supplier: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { paymentDate: "desc" },
    });

    const canCreate = role === "admin" || role === "supervisor";
    const showFinancials = canViewFinancialData(role);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Supplier Payments"
                    description={`Track payments made to suppliers - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="1m" />
                    {canCreate && (
                        <Link href="/finance/supplier-payments/new" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Record Payment
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <SupplierPaymentsTable payments={payments} role={role} showFinancials={showFinancials} />
        </div>
    );
}
