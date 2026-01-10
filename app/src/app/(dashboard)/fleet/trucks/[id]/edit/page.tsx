import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TruckForm } from "../../_components/truck-form";

interface EditTruckPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTruckPage({ params }: EditTruckPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const truck = await prisma.truck.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!truck) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Truck"
                description={`Update details for ${truck.registrationNo}`}
                backHref={`/fleet/trucks/${truck.id}`}
            />
            <TruckForm truck={truck} />
        </div>
    );
}
