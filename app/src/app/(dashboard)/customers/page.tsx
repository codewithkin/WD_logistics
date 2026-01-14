import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { CustomersTable } from "./_components/customers-table";
import { Plus } from "lucide-react";

export default async function CustomersPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

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
            _count: {
                select: {
                    trips: true,
                    invoices: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Customers"
                description="Manage your customers and clients"
                action={
                    canCreate
                        ? {
                            label: "Add Customer",
                            href: "/customers/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <CustomersTable customers={customers} role={role} />
        </div>
    );
}
