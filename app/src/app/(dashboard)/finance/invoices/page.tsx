import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicesTable } from "./_components/invoices-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";

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
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title="Invoices"
                    description={`Manage and track invoices - ${dateRange.label}`}
                    action={
                        canCreate
                            ? {
                                label: "Create Invoice",
                                href: "/finance/invoices/new",
                                icon: Plus,
                            }
                            : undefined
                    }
                />
                <PagePeriodSelector defaultPreset="1m" />
            </div>
            <InvoicesTable invoices={invoices} role={role} />
        </div>
    );
}
