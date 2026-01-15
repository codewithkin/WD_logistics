import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "./_components/users-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Users"
                    description="Manage users in your organization"
                />
                <Link href="/users/invite" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Invite User
                    </Button>
                </Link>
            </div>
            <UsersTable members={members} currentUserId={session.user.id} />
        </div>
    );
}
