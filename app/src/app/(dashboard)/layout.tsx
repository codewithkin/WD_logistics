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
    // Check if SHOW_EXPENSES is enabled (for supervisor access to expenses)
    const showExpenses = process.env.SHOW_EXPENSES === "true";

    // Run auth + sidebar badge count concurrently so every navigation doesn't
    // serialize two database round-trips before the shell can render.
    const [session, pendingEditRequests] = await Promise.all([
        requireAuth(),
        prisma.editRequest.count({
            where: {
                status: "pending",
            },
        }),
    ]);

    return (
        <SessionProvider
            user={session.user}
            role={session.role}
            organizationId={session.organizationId}
        >
            <div className="flex min-h-screen">
                <Sidebar pendingEditRequests={pendingEditRequests} showExpenses={showExpenses} />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header pendingEditRequests={pendingEditRequests} showExpenses={showExpenses} />
                    <main className="flex-1 p-3 sm:p-6 bg-muted/30 min-w-0 overflow-x-hidden">{children}</main>
                </div>
            </div>
        </SessionProvider>
    );
}
