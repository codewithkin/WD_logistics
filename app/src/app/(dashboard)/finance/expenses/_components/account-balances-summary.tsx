import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Landmark, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface AccountBalancesSummaryProps {
    accounts: { type: string; name: string; balance: number }[];
}

const ACCOUNT_ICONS: Record<string, typeof Banknote> = {
    cash: Banknote,
    bank: Landmark,
    petty_cash: Wallet,
};

export function AccountBalancesSummary({ accounts }: AccountBalancesSummaryProps) {
    return (
        <Link href="/finance/accounts" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Account Balances
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        {accounts.map((account) => {
                            const Icon = ACCOUNT_ICONS[account.type] || Wallet;
                            return (
                                <div key={account.type} className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground truncate">{account.name}</p>
                                        <p className="font-semibold">{formatCurrency(account.balance)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
