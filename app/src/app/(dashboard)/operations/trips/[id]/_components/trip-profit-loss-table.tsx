"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, TrendingUp, TrendingDown, Minus, Receipt, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { exportTripProfitLossPDF } from "./actions";

interface TripExpense {
    id: string;
    expense: {
        id: string;
        amount: number;
        description: string | null;
        date: Date;
        category: {
            name: string;
            color: string | null;
        } | null;
    };
}

interface TripInvoice {
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
    isCredit: boolean;
}

interface TripProfitLossTableProps {
    tripId: string;
    tripName: string;
    revenue: number;
    expenses: TripExpense[];
    invoice: TripInvoice | null;
}

export function TripProfitLossTable({
    tripId,
    tripName,
    revenue,
    expenses,
    invoice,
}: TripProfitLossTableProps) {
    const [isExporting, setIsExporting] = useState(false);

    const totalExpenses = expenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const grossProfit = revenue - totalExpenses;
    const isInvoicePaid = invoice?.status === "paid";
    const netProfit = isInvoicePaid ? grossProfit : 0;
    const pendingAmount = invoice ? invoice.balance : revenue;

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const result = await exportTripProfitLossPDF(tripId);
            if (result.success && result.data) {
                // Convert base64 to blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });

                // Download file
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename || `trip-profit-loss-${tripId}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> Trip Profit & Loss
                </CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    Export PDF
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Description</TableHead>
                                <TableHead className="font-semibold">Category / Type</TableHead>
                                <TableHead className="font-semibold">Date</TableHead>
                                <TableHead className="text-right font-semibold text-green-600">Income</TableHead>
                                <TableHead className="text-right font-semibold text-red-600">Expense</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Revenue Row */}
                            <TableRow className="bg-green-50/50">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-green-600" />
                                        Trip Revenue
                                        {invoice && (
                                            <Badge variant="outline" className="text-xs">
                                                {invoice.invoiceNumber}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                                        {invoice ? (isInvoicePaid ? "Paid Invoice" : "Pending Invoice") : "Revenue"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">—</TableCell>
                                <TableCell className="text-right font-semibold text-green-600">
                                    ${revenue.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">—</TableCell>
                            </TableRow>

                            {/* Expense Rows */}
                            {expenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                        <Receipt className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        No expenses recorded for this trip
                                    </TableCell>
                                </TableRow>
                            ) : (
                                expenses.map((te) => (
                                    <TableRow key={te.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Receipt className="h-4 w-4 text-red-500" />
                                                {te.expense.description || "Expense"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                                style={{
                                                    borderColor: te.expense.category?.color || undefined,
                                                    color: te.expense.category?.color || undefined,
                                                }}
                                            >
                                                {te.expense.category?.name || "Uncategorized"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(te.expense.date), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right">—</TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            ${te.expense.amount.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter>
                            {/* Subtotals */}
                            <TableRow className="bg-muted/30">
                                <TableCell colSpan={3} className="text-right font-medium">
                                    Subtotals
                                </TableCell>
                                <TableCell className="text-right font-semibold text-green-600">
                                    ${revenue.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-red-600">
                                    ${totalExpenses.toLocaleString()}
                                </TableCell>
                            </TableRow>
                            {/* Gross Profit */}
                            <TableRow className="bg-muted/50">
                                <TableCell colSpan={3} className="text-right font-semibold">
                                    Gross Profit / Loss
                                </TableCell>
                                <TableCell colSpan={2} className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {grossProfit > 0 ? (
                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                        ) : grossProfit < 0 ? (
                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                        ) : (
                                            <Minus className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span
                                            className={`text-lg font-bold ${grossProfit > 0
                                                    ? "text-green-600"
                                                    : grossProfit < 0
                                                        ? "text-red-600"
                                                        : "text-muted-foreground"
                                                }`}
                                        >
                                            ${Math.abs(grossProfit).toLocaleString()}
                                            {grossProfit < 0 && " (Loss)"}
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                            {/* Net Profit (only if invoice paid) */}
                            {invoice && (
                                <TableRow className={isInvoicePaid ? "bg-green-50" : "bg-amber-50"}>
                                    <TableCell colSpan={3} className="text-right font-semibold">
                                        {isInvoicePaid ? "Net Profit (Collected)" : "Pending Collection"}
                                    </TableCell>
                                    <TableCell colSpan={2} className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span
                                                className={`text-lg font-bold ${isInvoicePaid
                                                        ? netProfit >= 0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                        : "text-amber-600"
                                                    }`}
                                            >
                                                {isInvoicePaid
                                                    ? `$${Math.abs(netProfit).toLocaleString()}${netProfit < 0 ? " (Loss)" : ""}`
                                                    : `$${pendingAmount.toLocaleString()} pending`}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableFooter>
                    </Table>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-sm text-green-600 font-medium">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-700">${revenue.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-700">${totalExpenses.toLocaleString()}</p>
                    </div>
                    <div
                        className={`text-center p-4 rounded-lg border ${grossProfit >= 0
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-red-50 border-red-200"
                            }`}
                    >
                        <p className={`text-sm font-medium ${grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Gross {grossProfit >= 0 ? "Profit" : "Loss"}
                        </p>
                        <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            ${Math.abs(grossProfit).toLocaleString()}
                        </p>
                    </div>
                    <div
                        className={`text-center p-4 rounded-lg border ${isInvoicePaid
                                ? netProfit >= 0
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-red-50 border-red-200"
                                : "bg-amber-50 border-amber-200"
                            }`}
                    >
                        <p className={`text-sm font-medium ${isInvoicePaid
                                ? netProfit >= 0
                                    ? "text-blue-600"
                                    : "text-red-600"
                                : "text-amber-600"
                            }`}>
                            {isInvoicePaid ? (netProfit >= 0 ? "Net Profit" : "Net Loss") : "Pending"}
                        </p>
                        <p className={`text-2xl font-bold ${isInvoicePaid
                                ? netProfit >= 0
                                    ? "text-blue-700"
                                    : "text-red-700"
                                : "text-amber-700"
                            }`}>
                            ${isInvoicePaid ? Math.abs(netProfit).toLocaleString() : pendingAmount.toLocaleString()}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
