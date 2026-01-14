import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { SuppliersTable } from "./_components/suppliers-table";
import { SupplierCards } from "./_components/supplier-cards";
import { Plus } from "lucide-react";

export default async function SuppliersPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

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
            _count: {
                select: {
                    expenses: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });

    // Calculate totals for cards
    const totalOwing = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const activeSuppliers = suppliers.filter((s) => s.status === "active").length;
    const suppliersWithOwing = suppliers.filter((s) => s.balance > 0).length;

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Suppliers"
                description="Manage your suppliers and track amounts owed"
                action={
                    canCreate
                        ? {
                            label: "Add Supplier",
                            href: "/suppliers/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <SupplierCards
                totalSuppliers={suppliers.length}
                activeSuppliers={activeSuppliers}
                totalOwing={totalOwing}
                suppliersWithOwing={suppliersWithOwing}
            />
            <SuppliersTable suppliers={suppliers} role={role} />
        </div>
    );
}
