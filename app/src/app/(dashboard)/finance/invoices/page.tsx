import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicesTable } from "./_components/invoices-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface InvoicesPageProps {
    searchParams: Promise<{ customerId?: string; period?: string; from?: string; to?: string }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    const whereClause: Record<string, unknown> = {
        organizationId,
        issueDate: {
            gte: dateRange.from,
            lte: dateRange.to,
        },
    };

    if (params.customerId) {
        whereClause.customerId = params.customerId;
    }

    const invoices = await prisma.invoice.findMany({
        where: whereClause,
        include: {
            customer: true,
            payments: true,
        },
        orderBy: { issueDate: "desc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Invoices"
                    description={`Manage and track invoices - ${dateRange.label}`}
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full sm:w-auto">
                    <PagePeriodSelector defaultPreset="1m" />
                    {canCreate && (
                        <Link href="/finance/invoices/new" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Invoice
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            <InvoicesTable invoices={invoices} role={role} />
        </div>
    );
}
