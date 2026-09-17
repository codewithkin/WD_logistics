"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LocalDateTime } from "@/components/ui/local-date-time";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { Search } from "lucide-react";
import {
    ACCOUNT_TYPES,
    ACCOUNT_TYPE_LABELS,
    TRANSACTION_TYPE_LABELS,
    isDebitTransaction,
    type AccountTransactionType,
} from "@/lib/accounts";
import { formatCurrency, cn } from "@/lib/utils";

export interface LedgerRow {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    expenseId: string | null;
    date: Date;
    accountType: string;
    accountName: string;
    createdBy: { id: string; name: string };
}

type TypeFilter = "all" | "deposit" | "withdrawal" | "expense" | "transfer";

const TYPE_FILTERS: Record<Exclude<TypeFilter, "all">, string[]> = {
    deposit: ["deposit"],
    withdrawal: ["withdrawal"],
    expense: ["expense_debit", "expense_credit"],
    transfer: ["transfer_in", "transfer_out"],
};

const TYPE_BADGE: Record<string, string> = {
    deposit: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    withdrawal: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    expense_debit: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    expense_credit: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    transfer_in: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    transfer_out: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};

const ACCOUNT_DOT: Record<string, string> = {
    cash: "bg-green-500",
    bank: "bg-blue-500",
    petty_cash: "bg-amber-500",
};

interface AccountLedgerTableProps {
    transactions: LedgerRow[];
    accountFilter: string;
    onAccountFilterChange: (value: string) => void;
    currentUserId: string;
}

export function AccountLedgerTable({ transactions, accountFilter, onAccountFilterChange, currentUserId }: AccountLedgerTableProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [personFilter, setPersonFilter] = useState("all");

    const people = useMemo(() => {
        const map = new Map<string, string>();
        for (const t of transactions) map.set(t.createdBy.id, t.createdBy.name);
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [transactions]);

    const term = search.toLowerCase();
    const filtered = transactions.filter((t) => {
        if (accountFilter !== "all" && t.accountType !== accountFilter) return false;
        if (typeFilter !== "all" && !TYPE_FILTERS[typeFilter].includes(t.type)) return false;
        if (personFilter !== "all" && t.createdBy.id !== personFilter) return false;
        if (!term) return true;
        return (
            t.description?.toLowerCase().includes(term) ||
            t.createdBy.name.toLowerCase().includes(term) ||
            t.accountName.toLowerCase().includes(term)
        );
    });

    const totalIn = filtered.filter((t) => !isDebitTransaction(t.type)).reduce((s, t) => s + t.amount, 0);
    const totalOut = filtered.filter((t) => isDebitTransaction(t.type)).reduce((s, t) => s + t.amount, 0);

    const pagination = usePagination({ defaultPageSize: 15, totalItems: filtered.length });
    const rows = filtered.slice(pagination.startIndex, pagination.endIndex);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {["all", ...ACCOUNT_TYPES].map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => onAccountFilterChange(type)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            accountFilter === type
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {type !== "all" && <span className={cn("h-2 w-2 rounded-full", ACCOUNT_DOT[type])} />}
                        {type === "all" ? "All accounts" : ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS]}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1 lg:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search description or person..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3 lg:flex">
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                        <SelectTrigger className="w-full lg:w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All entries</SelectItem>
                            <SelectItem value="deposit">Money in</SelectItem>
                            <SelectItem value="withdrawal">Money out</SelectItem>
                            <SelectItem value="expense">Expenses</SelectItem>
                            <SelectItem value="transfer">Transfers</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={personFilter} onValueChange={setPersonFilter}>
                        <SelectTrigger className="w-full lg:w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Everyone</SelectItem>
                            {people.map(([id, name]) => (
                                <SelectItem key={id} value={id}>
                                    {id === currentUserId ? `${name} (you)` : name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Date</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="min-w-48">Description</TableHead>
                            <TableHead className="whitespace-nowrap">Recorded by</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Money in</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Money out</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Balance after</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                    {transactions.length === 0
                                        ? "No money has moved in this period"
                                        : "No entries match your filters"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((t) => {
                                const debit = isDebitTransaction(t.type);
                                const label = TRANSACTION_TYPE_LABELS[t.type as AccountTransactionType] ?? t.type;
                                return (
                                    <TableRow key={t.id}>
                                        <TableCell className="whitespace-nowrap">
                                            <LocalDateTime date={t.date} pattern="MMM d, yyyy" className="block font-medium" />
                                            <LocalDateTime date={t.date} pattern="h:mm a" className="block text-xs text-muted-foreground" />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <span className="inline-flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full", ACCOUNT_DOT[t.accountType] ?? "bg-muted-foreground")} />
                                                {t.accountName}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", TYPE_BADGE[t.type] ?? "bg-muted")}>
                                                {label}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {t.expenseId ? (
                                                <Link href={`/finance/expenses/${t.expenseId}`} className="hover:underline">
                                                    {t.description || "View expense"}
                                                </Link>
                                            ) : (
                                                t.description || <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {t.createdBy.name}
                                            {t.createdBy.id === currentUserId && (
                                                <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-green-600 whitespace-nowrap">
                                            {debit ? "" : `+${formatCurrency(t.amount)}`}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600 whitespace-nowrap">
                                            {debit ? `−${formatCurrency(t.amount)}` : ""}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(t.balanceAfter)}</TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                    {filtered.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5} className="font-medium">
                                    {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · net{" "}
                                    <span className={cn(totalIn - totalOut >= 0 ? "text-green-600" : "text-red-600")}>
                                        {totalIn - totalOut >= 0 ? "+" : "−"}
                                        {formatCurrency(Math.abs(totalIn - totalOut))}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap">
                                    +{formatCurrency(totalIn)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-red-600 whitespace-nowrap">
                                    −{formatCurrency(totalOut)}
                                </TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>

            {filtered.length > 0 && (
                <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={filtered.length}
                    setCurrentPage={pagination.setCurrentPage}
                    setPageSize={pagination.setPageSize}
                    startIndex={pagination.startIndex}
                    endIndex={pagination.endIndex}
                    canGoToPreviousPage={pagination.canGoToPreviousPage}
                    canGoToNextPage={pagination.canGoToNextPage}
                    goToFirstPage={pagination.goToFirstPage}
                    goToLastPage={pagination.goToLastPage}
                    goToPreviousPage={pagination.goToPreviousPage}
                    goToNextPage={pagination.goToNextPage}
                />
            )}
        </div>
    );
}
