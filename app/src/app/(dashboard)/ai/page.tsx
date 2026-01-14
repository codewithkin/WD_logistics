import { requireRole } from "@/lib/session";
import { AIChatPage } from "./_components/ai-chat-page";

export const metadata = {
    title: "AI Assistant | WD Logistics",
    description: "AI-powered assistant for logistics operations",
};

export default async function AIPage() {
    // Guard: Only admins can access the AI Assistant
    const session = await requireRole(["admin"]);

    return (
        <AIChatPage
            organizationId={session.organizationId}
            userEmail={session.user.email}
            userName={session.user.name}
        />
    );
}
