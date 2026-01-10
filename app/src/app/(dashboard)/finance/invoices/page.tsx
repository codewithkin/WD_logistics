import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicesTable } from "./_components/invoices-table";
import { Plus } from "lucide-react";

interface InvoicesPageProps {
    searchParams: Promise<{ customerId?: string }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const whereClause: Record<string, unknown> = { organizationId };

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
            <PageHeader
                title="Invoices"
                description="Manage and track invoices"
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
            <InvoicesTable invoices={invoices} role={role} />
        </div>
    );
}
