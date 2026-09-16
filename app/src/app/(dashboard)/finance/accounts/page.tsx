import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { AccountsClient } from "./_components/accounts-client";
import { getAccounts } from "./actions";

export default async function AccountsPage() {
    const session = await requireRole(["admin", "supervisor"]);

    const accounts = await getAccounts();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Accounts"
                description="Cash, Bank, and Petty Cash balances"
            />
            <AccountsClient accounts={accounts} role={session.role} />
        </div>
    );
}
