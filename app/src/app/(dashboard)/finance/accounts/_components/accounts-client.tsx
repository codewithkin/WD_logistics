"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowDownLeft,
    ArrowRightLeft,
    ArrowUpRight,
    Banknote,
    Info,
    Landmark,
    Loader2,
    Pencil,
    Receipt,
    Wallet,
} from "lucide-react";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/accounts";
import { Role } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import { transferFundsAction, setStartingBalance } from "../actions";
import { toast } from "sonner";
import { AccountMovementDialog, type MovementDirection } from "./account-movement-dialog";
import { AccountLedgerTable, type LedgerRow } from "./account-ledger-table";

interface AccountSummary {
    id: string;
    type: string;
    name: string;
    balance: number;
    startingBalance: number;
    transactionCount: number;
    periodIn: number;
    periodOut: number;
    lastActivity: Date | null;
}

interface AccountsClientProps {
    accounts: AccountSummary[];
    transactions: LedgerRow[];
    periodLabel: string;
    role: Role;
    /** Money in is admin-only; money out is open to supervisors too. */
    canRecordIn: boolean;
    canRecordOut: boolean;
    canTransfer: boolean;
    currentUserId: string;
}

const ACCOUNT_ICONS: Record<string, typeof Banknote> = {
    cash: Banknote,
    bank: Landmark,
    petty_cash: Wallet,
};

// Cash carries the brand green, Bank is the one deliberately-sparing use of
// blue, Petty Cash gets a distinct warm accent — matches the gradient
// icon-badge + tinted-card pattern used on the main dashboard.
const ACCOUNT_STYLES: Record<string, { bgGradient: string; iconGradient: string; textColor: string }> = {
    cash: {
        bgGradient: "linear-gradient(to bottom right, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))",
        iconGradient: "linear-gradient(to bottom right, #22c55e, #10b981)",
        textColor: "#16a34a",
    },
    bank: {
        bgGradient: "linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(34, 211, 238, 0.1))",
        iconGradient: "linear-gradient(to bottom right, #3b82f6, #06b6d4)",
        textColor: "#2563eb",
    },
    petty_cash: {
        bgGradient: "linear-gradient(to bottom right, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.1))",
        iconGradient: "linear-gradient(to bottom right, #f59e0b, #f97316)",
        textColor: "#d97706",
    },
};

const TRANSFERABLE_TYPES: AccountType[] = ["cash", "petty_cash"];

export function AccountsClient({
    accounts,
    transactions,
    periodLabel,
    role,
    canRecordIn,
    canRecordOut,
    canTransfer,
    currentUserId,
}: AccountsClientProps) {
    const router = useRouter();
    const isAdmin = role === "admin";

    const [accountFilter, setAccountFilter] = useState("all");

    const [movementDialog, setMovementDialog] = useState<{ account: AccountType; direction: MovementDirection } | null>(null);

    const [transferOpen, setTransferOpen] = useState(false);
    const [fromType, setFromType] = useState<AccountType>("cash");
    const [toType, setToType] = useState<AccountType>("petty_cash");
    const [transferAmount, setTransferAmount] = useState("");
    const [transferDescription, setTransferDescription] = useState("");

    const [editingType, setEditingType] = useState<AccountType | null>(null);
    const [startingBalanceInput, setStartingBalanceInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const balances = Object.fromEntries(accounts.map((a) => [a.type, a.balance]));
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const totalIn = accounts.reduce((sum, a) => sum + a.periodIn, 0);
    const totalOut = accounts.reduce((sum, a) => sum + a.periodOut, 0);
    const net = totalIn - totalOut;

    const handleTransfer = async () => {
        const amount = parseFloat(transferAmount);
        if (!amount || amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await transferFundsAction({
                fromType,
                toType,
                amount,
                description: transferDescription || undefined,
            });
            if (result.success) {
                toast.success("Transfer completed");
                setTransferOpen(false);
                setTransferAmount("");
                setTransferDescription("");
                router.refresh();
            } else {
                toast.error(result.error || "Transfer failed");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSetStartingBalance = async (type: AccountType) => {
        const amount = parseFloat(startingBalanceInput);
        if (isNaN(amount) || amount < 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await setStartingBalance(type, amount);
            if (result.success) {
                toast.success("Starting balance set");
                setEditingType(null);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to set starting balance");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Overview */}
            <Card className="border-none relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(120deg, rgba(34, 197, 94, 0.14), rgba(16, 185, 129, 0.06) 55%, rgba(59, 130, 246, 0.06))" }}
                />
                <CardContent className="relative p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total across all accounts</p>
                            <p className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#16a34a" }}>
                                {formatCurrency(totalBalance)}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">{periodLabel}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 sm:gap-6">
                            <div>
                                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" /> Money in
                                </p>
                                <p className="mt-1 text-lg sm:text-xl font-semibold text-green-600">{formatCurrency(totalIn)}</p>
                            </div>
                            <div>
                                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    <ArrowUpRight className="h-3.5 w-3.5 text-red-600" /> Money out
                                </p>
                                <p className="mt-1 text-lg sm:text-xl font-semibold text-red-600">{formatCurrency(totalOut)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Net change</p>
                                <p className={cn("mt-1 text-lg sm:text-xl font-semibold", net >= 0 ? "text-green-600" : "text-red-600")}>
                                    {net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(net))}
                                </p>
                            </div>
                        </div>
                    </div>

                    {(canRecordIn || canRecordOut || canTransfer) && (
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                            {(canRecordIn || canRecordOut) && (
                                <Button
                                    onClick={() =>
                                        setMovementDialog({
                                            account: "petty_cash",
                                            direction: canRecordIn ? "deposit" : "withdrawal",
                                        })
                                    }
                                >
                                    <Receipt className="mr-2 h-4 w-4" />
                                    {canRecordIn ? "Record Money In / Out" : "Record Money Out"}
                                </Button>
                            )}
                            {canTransfer && (
                                <Button variant="outline" onClick={() => setTransferOpen(true)} className="bg-background/70">
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    Transfer Between Accounts
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-account cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account, index) => {
                    const Icon = ACCOUNT_ICONS[account.type] || Wallet;
                    const style = ACCOUNT_STYLES[account.type] || ACCOUNT_STYLES.cash;
                    const canEditStarting = isAdmin && account.transactionCount === 0;
                    const isSelected = accountFilter === account.type;
                    return (
                        <Card
                            key={account.id}
                            className={cn(
                                "group hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 border-none relative overflow-hidden cursor-pointer",
                                isSelected && "ring-2 ring-primary"
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                            onClick={() => setAccountFilter(isSelected ? "all" : account.type)}
                        >
                            <div
                                className="absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity duration-300"
                                style={{ background: style.bgGradient }}
                            />
                            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <div
                                        className="p-1.5 rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-110"
                                        style={{ background: style.iconGradient }}
                                    >
                                        <Icon className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    {account.name}
                                </CardTitle>
                                {canEditStarting && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        title="Set starting balance"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setStartingBalanceInput(String(account.startingBalance));
                                            setEditingType(account.type as AccountType);
                                        }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="relative space-y-3">
                                <p className="text-2xl font-bold" style={{ color: style.textColor }}>
                                    {formatCurrency(account.balance)}
                                </p>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="flex items-center gap-1 text-green-600">
                                        <ArrowDownLeft className="h-3 w-3" />
                                        {formatCurrency(account.periodIn)}
                                    </span>
                                    <span className="flex items-center gap-1 text-red-600">
                                        <ArrowUpRight className="h-3 w-3" />
                                        {formatCurrency(account.periodOut)}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {account.lastActivity ? (
                                        <>
                                            Last activity <LocalDateTime date={account.lastActivity} pattern="relative" />
                                        </>
                                    ) : (
                                        "No activity yet"
                                    )}
                                </p>
                                {(canRecordIn || canRecordOut) && (
                                    <div className="flex gap-2 pt-1">
                                        {canRecordIn && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 flex-1 bg-background/70"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMovementDialog({ account: account.type as AccountType, direction: "deposit" });
                                            }}
                                        >
                                            <ArrowDownLeft className="mr-1 h-3.5 w-3.5 text-green-600" />
                                            In
                                        </Button>
                                        )}
                                        {canRecordOut && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 flex-1 bg-background/70"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMovementDialog({ account: account.type as AccountType, direction: "withdrawal" });
                                            }}
                                        >
                                            <ArrowUpRight className="mr-1 h-3.5 w-3.5 text-amber-600" />
                                            Out
                                        </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {!isAdmin && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        You can record money handed in or taken out — every entry shows your name. Transfers between
                        accounts and starting balances are handled by an admin.
                    </p>
                </div>
            )}

            {/* Ledger */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Transaction History</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Every movement of money — when, what for, and who recorded it. Click an account card to filter.
                    </p>
                </CardHeader>
                <CardContent>
                    <AccountLedgerTable
                        transactions={transactions}
                        accountFilter={accountFilter}
                        onAccountFilterChange={setAccountFilter}
                        currentUserId={currentUserId}
                    />
                </CardContent>
            </Card>

            <AccountMovementDialog
                open={movementDialog !== null}
                onOpenChange={(open) => !open && setMovementDialog(null)}
                initialAccount={movementDialog?.account}
                initialDirection={movementDialog?.direction}
                canRecordIn={canRecordIn}
                balances={balances}
            />

            {canTransfer && (
                <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Transfer Funds</DialogTitle>
                            <DialogDescription>
                                Move money between Cash and Petty Cash. Bank isn&apos;t part of these transfers.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>From</Label>
                                    <Select value={fromType} onValueChange={(v) => setFromType(v as AccountType)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRANSFERABLE_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {ACCOUNT_TYPE_LABELS[type]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>To</Label>
                                    <Select value={toType} onValueChange={(v) => setToType(v as AccountType)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRANSFERABLE_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {ACCOUNT_TYPE_LABELS[type]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Input
                                    value={transferDescription}
                                    onChange={(e) => setTransferDescription(e.target.value)}
                                    placeholder="Reason for transfer"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleTransfer} disabled={isSubmitting || fromType === toType}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Transfer
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={editingType !== null} onOpenChange={(open) => !open && setEditingType(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Set Starting Balance — {editingType ? ACCOUNT_TYPE_LABELS[editingType] : ""}
                        </DialogTitle>
                        <DialogDescription>Only available before this account has any transactions.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Starting Balance</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={startingBalanceInput}
                            onChange={(e) => setStartingBalanceInput(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => editingType && handleSetStartingBalance(editingType)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
