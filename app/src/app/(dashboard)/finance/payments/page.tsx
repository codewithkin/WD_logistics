import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsTable } from "./_components/payments-table";
import { Plus } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";

interface PaymentsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    const payments = await prisma.payment.findMany({
        where: {
            invoice: { organizationId },
            paymentDate: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
        },
        include: {
            invoice: {
                include: {
                    customer: true,
                },
            },
        },
        orderBy: { paymentDate: "desc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title="Payments"
                    description={`Track and manage payments - ${dateRange.label}`}
                    action={
                        canCreate
                            ? {
                                label: "Record Payment",
                                href: "/finance/payments/new",
                                icon: Plus,
                            }
                            : undefined
                    }
                />
                <PagePeriodSelector defaultPreset="1m" />
            </div>
            <PaymentsTable payments={payments} role={role} />
        </div>
    );
}
