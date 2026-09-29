import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TrailerForm } from "../_components/trailer-form";

export default async function NewTrailerPage() {
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a trailer" />;

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
