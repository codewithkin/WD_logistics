import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ExpenseCategoriesTableClient } from "./expense-categories-table-client";

export async function ExpenseCategoriesTable() {
    const user = await requireRole(["admin", "supervisor"]);

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

    return <ExpenseCategoriesTableClient categories={categories} />;
}
