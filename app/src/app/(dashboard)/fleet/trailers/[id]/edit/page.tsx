import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { TrailerForm } from "../../_components/trailer-form";

interface EditTrailerPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTrailerPage({ params }: EditTrailerPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const trailer = await prisma.trailer.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!trailer) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Trailer"
                description={`Update details for ${trailer.registrationNo}`}
                backHref={`/fleet/trailers/${trailer.id}`}
            />
            <TrailerForm trailer={trailer} />
        </div>
    );
}
