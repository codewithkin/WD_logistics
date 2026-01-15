import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DriverForm } from "../../_components/driver-form";

interface EditDriverPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditDriverPage({ params }: EditDriverPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const driver = await prisma.driver.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!driver) {
        notFound();
    }

    // Get available trucks (unassigned or currently assigned to this driver)
    const availableTrucks = await prisma.truck.findMany({
        where: {
            organizationId: session.organizationId,
        },
        select: {
            id: true,
            registrationNo: true,
        },
        orderBy: { registrationNo: "asc" },
    });

    const isSupervisor = session.role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Edit Driver"
                description={`Update details for ${driver.firstName} ${driver.lastName}`}
                backHref={`/fleet/drivers/${driver.id}`}
            />
            <DriverForm driver={driver} availableTrucks={availableTrucks} isSupervisor={isSupervisor} />
        </div>
    );
}
