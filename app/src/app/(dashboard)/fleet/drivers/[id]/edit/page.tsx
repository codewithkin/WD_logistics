import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DriverForm } from "../../_components/driver-form";
import { getExpiryReminders } from "@/lib/expiry-reminders-server";

interface EditDriverPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditDriverPage({ params }: EditDriverPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const driver = await prisma.driver.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            assignedTruck: { select: { id: true, registrationNo: true, make: true, model: true } },
        },
    });

    if (!driver) {
        notFound();
    }

    // The truck picker searches for itself; only the current one is loaded,
    // so its plate shows before the dialog is ever opened.
    const isSupervisor = session.role === "supervisor";
    const reminders = await getExpiryReminders(session.organizationId, "driver", driver.id);

    return (
        <div>
            <PageHeader
                title="Edit Driver"
                description={`Update details for ${driver.firstName} ${driver.lastName}`}
                backHref={`/fleet/drivers/${driver.id}`}
            />
            <DriverForm
                driver={driver}
                assignedTruck={
                    driver.assignedTruck
                        ? {
                              id: driver.assignedTruck.id,
                              label: driver.assignedTruck.registrationNo,
                              description: `${driver.assignedTruck.make} ${driver.assignedTruck.model}`,
                          }
                        : undefined
                }
                isSupervisor={isSupervisor}
                reminders={reminders}
            />
        </div>
    );
}
