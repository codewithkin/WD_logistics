import { ReactNode } from "react";
import { requireAuth } from "@/lib/session";
import { SessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { PushSync } from "@/components/providers/push-sync";

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    // Check if SHOW_EXPENSES is enabled (for supervisor access to expenses)
    const showExpenses = process.env.SHOW_EXPENSES === "true";

    const session = await requireAuth();

    // The pending-requests badge belongs to the approver. It is counted only
    // for an admin — the queue is admin-only (ACCESS_CONTROL.md), so showing
    // anyone else a number for a page they cannot open both leaks that
    // requests exist and offers a dead link.
    //
    // It is also scoped by organisation now. The TODO that stood here counted
    // pending requests across every organisation in the database.
    const pendingEditRequests =
        session.role === "admin"
            ? await prisma.editRequest.count({
                  where: {
                      organizationId: session.organizationId,
                      status: "pending",
                  },
              })
            : 0;

    return (
        <SessionProvider
            user={session.user}
            role={session.role}
            organizationId={session.organizationId}
        >
            <PushSync userId={session.user.id} />
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
