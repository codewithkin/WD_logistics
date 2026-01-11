import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ExpenseCategoriesClient } from "./_components/expense-categories-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ExpenseCategoriesPage() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    const categories = await prisma.expenseCategory.findMany({
        where: {
            organizationId: user.organizationId,
        },
        include: {
            _count: {
                select: {
                    expenses: true,
                },
            },
        },
        orderBy: {
            name: "asc",
        },
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expense Categories"
                description="Manage expense categories and their settings"
                action={
                    <Link href="/finance/expenses">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Expenses
                        </Button>
                    </Link>
                }
            />
            <ExpenseCategoriesClient categories={categories} />
        </div>
    );
}
