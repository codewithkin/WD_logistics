import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "../../_components/trip-form";

interface EditTripPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTripPage({ params }: EditTripPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor", "staff"]);
    const showFinancials = canViewFinancialData(session.role);

    // Only the three related records the trip already points at are loaded —
    // enough to label the pickers. The pickers search for everything else.
    const trip = await prisma.trip.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            truck: { select: { registrationNo: true, make: true, model: true } },
            driver: { select: { firstName: true, lastName: true, phone: true } },
            customer: { select: { name: true, contactPerson: true } },
        },
    });

    if (!trip) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Trip"
                description={`Update trip: ${trip.originCity} → ${trip.destinationCity}`}
                backHref={`/operations/trips/${trip.id}`}
            />
            <TripForm
                trip={trip}
                selected={{
                    truck: {
                        label: trip.truck.registrationNo,
                        description: `${trip.truck.make} ${trip.truck.model}`,
                    },
                    driver: {
                        label: `${trip.driver.firstName} ${trip.driver.lastName}`,
                        description: trip.driver.phone,
                    },
                    customer: trip.customer
                        ? {
                              label: trip.customer.name,
                              description: trip.customer.contactPerson ?? undefined,
                          }
                        : undefined,
                }}
                showFinancials={showFinancials}
            />
        </div>
    );
}
