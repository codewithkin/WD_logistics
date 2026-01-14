import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ExpensesTableClient } from "./expenses-table-client";

export async function ExpensesTable() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    const expenses = await prisma.expense.findMany({
        where: {
            organizationId: user.organizationId,
        },
        include: {
            category: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            },
            truckExpenses: {
                include: {
                    truck: {
                        select: {
                            registrationNo: true,
                        },
                    },
                },
            },
            tripExpenses: {
                include: {
                    trip: {
                        select: {
                            id: true,
                            originCity: true,
                            destinationCity: true,
                        },
                    },
                },
            },
            driverExpenses: {
                include: {
                    driver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            date: "desc",
        },
    });

    return <ExpensesTableClient expenses={expenses} />;
}
