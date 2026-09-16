"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Banknote, Landmark, Wallet, ArrowRightLeft, Loader2, Pencil } from "lucide-react";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/accounts";
import { Role } from "@/lib/types";
import { transferFundsAction, setStartingBalance } from "../actions";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface Account {
    id: string;
    type: string;
    name: string;
    balance: number;
    startingBalance: number;
    _count: { transactions: number };
}

interface AccountsClientProps {
    accounts: Account[];
    role: Role;
}

const ACCOUNT_ICONS: Record<string, typeof Banknote> = {
    cash: Banknote,
    bank: Landmark,
    petty_cash: Wallet,
};

const TRANSFERABLE_TYPES: AccountType[] = ["cash", "petty_cash"];

export function AccountsClient({ accounts, role }: AccountsClientProps) {
    const router = useRouter();
    const isAdmin = role === "admin";

    const [transferOpen, setTransferOpen] = useState(false);
    const [fromType, setFromType] = useState<AccountType>("cash");
    const [toType, setToType] = useState<AccountType>("petty_cash");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingType, setEditingType] = useState<AccountType | null>(null);
    const [startingBalanceInput, setStartingBalanceInput] = useState("");

    const handleTransfer = async () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await transferFundsAction({
                fromType,
                toType,
                amount: numAmount,
                description: description || undefined,
            });
            if (result.success) {
                toast.success("Transfer completed");
                setTransferOpen(false);
                setAmount("");
                setDescription("");
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
        const numAmount = parseFloat(startingBalanceInput);
        if (isNaN(numAmount) || numAmount < 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await setStartingBalance(type, numAmount);
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
            <div className="grid gap-4 sm:grid-cols-3">
                {accounts.map((account) => {
                    const Icon = ACCOUNT_ICONS[account.type] || Wallet;
                    const canEditStarting = isAdmin && account._count.transactions === 0;
                    return (
                        <Card key={account.id}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Icon className="h-4 w-4" /> {account.name}
                                </CardTitle>
                                {canEditStarting && (
                                    <Dialog
                                        open={editingType === account.type}
                                        onOpenChange={(open) => {
                                            setEditingType(open ? (account.type as AccountType) : null);
                                            setStartingBalanceInput(open ? String(account.startingBalance) : "");
                                        }}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Set Starting Balance — {account.name}</DialogTitle>
                                                <DialogDescription>
                                                    Only available before this account has any transactions.
                                                </DialogDescription>
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
                                                    onClick={() => handleSetStartingBalance(account.type as AccountType)}
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {isAdmin && (
                <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transfer Funds
                        </Button>
                    </DialogTrigger>
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
                                        <SelectTrigger>
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
                                        <SelectTrigger>
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
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
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
        </div>
    );
}
