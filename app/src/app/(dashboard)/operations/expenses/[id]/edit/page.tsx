import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../../_components/expense-form";

interface EditExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    // Only the two records this expense already points at are loaded, to label
    // the form's pickers. The pickers search for everything else.
    const expense = await prisma.expense.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            category: { select: { id: true, name: true } },
            tripExpenses: {
                include: {
                    trip: {
                        select: {
                            originCity: true,
                            destinationCity: true,
                            scheduledDate: true,
                        },
                    },
                },
            },
        },
    });

    if (!expense) {
        notFound();
    }

    const linkedTrip = expense.tripExpenses[0];

    return (
        <div>
            <PageHeader
                title="Edit Expense"
                description="Update expense details"
                backHref="/operations/expenses"
            />
            <ExpenseForm
                expense={expense}
                initialSelected={{
                    category: expense.category
                        ? { id: expense.category.id, label: expense.category.name }
                        : undefined,
                    trip: linkedTrip
                        ? {
                              id: linkedTrip.tripId,
                              label: `${linkedTrip.trip.originCity} → ${linkedTrip.trip.destinationCity}`,
                              description: linkedTrip.trip.scheduledDate.toLocaleDateString("en-GB"),
                          }
                        : undefined,
                }}
            />
        </div>
    );
}
