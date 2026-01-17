import { ReactNode } from "react";
import { requireAuth } from "@/lib/session";
import { SessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await requireAuth();

    // Get pending edit requests count for badge
    const pendingEditRequests = await prisma.editRequest.count({
        where: {
            status: "pending",
        },
    });

    // Check if SHOW_EXPENSES is enabled (for supervisor access to expenses)
    const showExpenses = process.env.SHOW_EXPENSES === "true";

    return (
        <SessionProvider
            user={session.user}
            role={session.role}
            organizationId={session.organizationId}
        >
            <div className="flex min-h-screen">
                <Sidebar pendingEditRequests={pendingEditRequests} showExpenses={showExpenses} />
                <div className="flex-1 flex flex-col">
                    <Header />
                    <main className="flex-1 p-6 bg-muted/30">{children}</main>
                </div>
            </div>
        </SessionProvider>
    );
}
