import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "./_components/users-table";
import { Plus } from "lucide-react";

export default async function UsersPage() {
    const session = await requireRole(["admin"]);
    const { organizationId } = session;

    const members = await prisma.member.findMany({
        where: { organizationId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div>
            <PageHeader
                title="Users"
                description="Manage users in your organization"
                action={{
                    label: "Invite User",
                    href: "/users/invite",
                    icon: Plus,
                }}
            />
            <UsersTable members={members} currentUserId={session.user.id} />
        </div>
    );
}
