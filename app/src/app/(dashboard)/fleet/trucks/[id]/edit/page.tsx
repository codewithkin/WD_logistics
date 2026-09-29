import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TruckForm } from "../../_components/truck-form";
import { getExpiryReminders } from "@/lib/expiry-reminders-server";

interface EditTruckPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTruckPage({ params }: EditTruckPageProps) {
    const { id } = await params;
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) return <NoAccess role={access.role} what="editing a truck" />;
    const session = access.session;

    const truck = await prisma.truck.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!truck) {
        notFound();
    }

    const reminders = await getExpiryReminders(session.organizationId, "truck", truck.id);

    return (
        <div>
            <PageHeader
                title="Edit Truck"
                description={`Update details for ${truck.registrationNo}`}
                backHref={`/fleet/trucks/${truck.id}`}
            />
            <TruckForm truck={truck} reminders={reminders} />
        </div>
    );
}
