import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TrailerForm } from "../_components/trailer-form";

export default async function NewTrailerPage() {
    await requireRole(["admin", "supervisor"]);

    return (
        <div>
            <PageHeader
                title="Add New Trailer"
                description="Add a new trailer to your fleet"
                backHref="/fleet/trailers"
            />
            <TrailerForm />
        </div>
    );
}
