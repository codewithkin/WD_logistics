"use client";

import { useState } from "react";
import Link from "next/link";
import { LocalDateTime } from "@/components/ui/local-date-time";
import {
    Table,
    TableBody,
    TableCell,
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
import { ArrowDownLeft, ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { STOCK_MOVEMENT_LABELS, type StockMovementType } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface StockMovementRow {
    id: string;
    type: string;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    destination: string | null;
    reason: string | null;
    createdAt: Date;
    performedBy: { name: string };
    inventoryItem: { id: string; name: string; unit: string | null };
}

const TYPE_STYLES: Record<StockMovementType, { className: string; icon: typeof ArrowUpRight; sign: string }> = {
    in: { className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", icon: ArrowDownLeft, sign: "+" },
    out: { className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400", icon: ArrowUpRight, sign: "−" },
    adjustment: { className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: SlidersHorizontal, sign: "±" },
};

interface StockMovementsTableProps {
    movements: StockMovementRow[];
    showItem?: boolean;
    emptyMessage?: string;
}

export function StockMovementsTable({ movements, showItem = false, emptyMessage = "No stock movements recorded yet" }: StockMovementsTableProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | StockMovementType>("all");

    const term = search.toLowerCase();
    const filtered = movements.filter((m) => {
        if (typeFilter !== "all" && m.type !== typeFilter) return false;
        if (!term) return true;
        return (
            m.inventoryItem.name.toLowerCase().includes(term) ||
            m.destination?.toLowerCase().includes(term) ||
            m.reason?.toLowerCase().includes(term) ||
            m.performedBy.name.toLowerCase().includes(term)
        );
    });

    const pagination = usePagination({ defaultPageSize: 10, totalItems: filtered.length });
    const rows = filtered.slice(pagination.startIndex, pagination.endIndex);
    const columnCount = showItem ? 7 : 6;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder={showItem ? "Search item, where, why, or who..." : "Search where, why, or who..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                    <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All movements</SelectItem>
                        <SelectItem value="out">Taken out</SelectItem>
                        <SelectItem value="in">Stock in</SelectItem>
                        <SelectItem value="adjustment">Adjustments</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap">When</TableHead>
                            {showItem && <TableHead>Item</TableHead>}
                            <TableHead>Movement</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Stock</TableHead>
                            <TableHead>Where</TableHead>
                            <TableHead className="min-w-40">Why</TableHead>
                            <TableHead className="whitespace-nowrap">By</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columnCount} className="text-center py-8 text-muted-foreground">
                                    {movements.length === 0 ? emptyMessage : "No movements match your filters"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((m) => {
                                const type = (m.type in TYPE_STYLES ? m.type : "adjustment") as StockMovementType;
                                const style = TYPE_STYLES[type];
                                const Icon = style.icon;
                                const unit = m.inventoryItem.unit || "";
                                const sign = type === "adjustment" ? (m.quantityAfter >= m.quantityBefore ? "+" : "−") : style.sign;
                                return (
                                    <TableRow key={m.id}>
                                        <TableCell className="whitespace-nowrap">
                                            <LocalDateTime date={m.createdAt} pattern="MMM d, yyyy" className="block font-medium" />
                                            <LocalDateTime date={m.createdAt} pattern="h:mm a" className="block text-xs text-muted-foreground" />
                                        </TableCell>
                                        {showItem && (
                                            <TableCell className="font-medium">
                                                <Link href={`/inventory/${m.inventoryItem.id}`} className="hover:underline">
                                                    {m.inventoryItem.name}
                                                </Link>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", style.className)}>
                                                    <Icon className="h-3 w-3" />
                                                    {STOCK_MOVEMENT_LABELS[type]}
                                                </span>
                                                <span className="font-semibold">
                                                    {sign}{m.quantity} {unit}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                            {m.quantityBefore} → <span className="font-medium text-foreground">{m.quantityAfter}</span>
                                        </TableCell>
                                        <TableCell>{m.destination || <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="text-sm">{m.reason || <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="whitespace-nowrap">{m.performedBy.name}</TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
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
