import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "../../_components/customer-form";

interface EditCustomerPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor", "staff"]);

    const customer = await prisma.customer.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!customer) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Customer"
                description={`Update details for ${customer.name}`}
                backHref={`/customers/${customer.id}`}
            />
            <CustomerForm customer={customer} />
        </div>
    );
}
