import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsTable } from "./_components/payments-table";
import { Plus } from "lucide-react";

export default async function PaymentsPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const payments = await prisma.payment.findMany({
        where: { organizationId },
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
            <PageHeader
                title="Payments"
                description="Track and manage payments"
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
            <PaymentsTable payments={payments} role={role} />
        </div>
    );
}
