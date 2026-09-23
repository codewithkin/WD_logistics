import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../../_components/expense-form";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canViewExpensesPage } from "@/lib/permissions";

interface EditExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
    const { id } = await params;
    const user = await requireRole(["admin", "supervisor"]);

    // Check if user can view expenses page
    if (!canViewExpensesPage(user.role)) {
        redirect("/dashboard");
    }

    // Only what this expense is already linked to is loaded — enough to label
    // the form's pickers, which search for everything else themselves.
    const expense = await prisma.expense.findUnique({
        where: {
            id,
            organizationId: user.organizationId,
        },
        include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true, contactPerson: true } },
            truckExpenses: {
                select: {
                    truckId: true,
                    truck: { select: { registrationNo: true, make: true, model: true } },
                },
            },
            trailerExpenses: {
                select: {
                    trailerId: true,
                    trailer: { select: { registrationNo: true, make: true, model: true } },
                },
            },
            tripExpenses: {
                select: {
                    tripId: true,
                    trip: {
                        select: {
                            originCity: true,
                            destinationCity: true,
                            scheduledDate: true,
                        },
                    },
                },
            },
            driverExpenses: {
                select: {
                    driverId: true,
                    driver: { select: { firstName: true, lastName: true, phone: true } },
                },
            },
        },
    });

    if (!expense) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Edit Expense"
                description="Update expense details"
            />
            <div className="w-full">
                <ExpenseForm
                    expense={expense}
                    initialSelected={{
                        category: expense.category
                            ? { id: expense.category.id, label: expense.category.name }
                            : undefined,
                        supplier: expense.supplier
                            ? {
                                  id: expense.supplier.id,
                                  label: expense.supplier.name,
                                  description: expense.supplier.contactPerson ?? undefined,
                              }
                            : undefined,
                        trucks: expense.truckExpenses.map((te) => ({
                            id: te.truckId,
                            label: te.truck.registrationNo,
                            description: `${te.truck.make} ${te.truck.model}`,
                        })),
                        trailers: expense.trailerExpenses.map((te) => ({
                            id: te.trailerId,
                            label: te.trailer.registrationNo,
                            description: `${te.trailer.make} ${te.trailer.model}`,
                        })),
                        trips: expense.tripExpenses.map((te) => ({
                            id: te.tripId,
                            label: `${te.trip.originCity} → ${te.trip.destinationCity}`,
                            description: te.trip.scheduledDate.toLocaleDateString("en-GB"),
                        })),
                        drivers: expense.driverExpenses.map((de) => ({
                            id: de.driverId,
                            label: `${de.driver.firstName} ${de.driver.lastName}`,
                            description: de.driver.phone ?? undefined,
                        })),
                    }}
                />
            </div>
        </div>
    );
}
