"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileSpreadsheet, BarChart3, DollarSign, Receipt, Truck, MapPin, List, FileText, Download, User } from "lucide-react";
import Link from "next/link";
import { ExpensesTableClient, type Expense } from "./expenses-table-client";
import { ExpenseCharts } from "./expense-charts";
import { formatCurrency } from "@/lib/utils";

interface Category {
    id: string;
    name: string;
    description: string | null;
    isTruck: boolean;
    isTrip: boolean;
    color: string | null;
    _count: {
        expenses: number;
    };
}


interface ExpensesOverviewProps {
    categories: Category[];
    expenses: Expense[];
    periodLabel?: string;
    /**
     * Exports are admin-only (ACCESS_CONTROL.md, "Reports — all 23, including
     * every export button on every list page"). A supervisor reads these
     * amounts on screen — that is their job — but does not take them out of
     * the app, and the action refuses them, so the menu is not shown.
     */
    canExport?: boolean;
    /**
     * The Analytics tab: admin only since 2026-09-30. It is spending charted
     * by truck, trip, driver and category — a report in everything but the
     * name, and the same totals ACCESS_CONTROL.md keeps with the owner. The
     * list beside it is the part of the page a supervisor works in and stays.
     */
    showAnalytics?: boolean;
}

export function ExpensesOverview({ categories, expenses, periodLabel = "This Period", canExport = false, showAnalytics = false }: ExpensesOverviewProps) {
    const [activeTab, setActiveTab] = useState("expenses");
    const tableRef = useState<any>(null)[1];

    // Calculate summary stats (expenses are already filtered by the selected period)
    const stats = useMemo(() => {
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const withTrucks = expenses.filter(e => e.truckExpenses.length > 0).length;
        const withTrips = expenses.filter(e => e.tripExpenses.length > 0).length;

        return {
            total: totalExpenses,
            periodTotal: totalExpenses, // Same as total since already filtered
            count: expenses.length,
            withTrucks,
            withTrips,
            categoriesCount: categories.length,
        };
    }, [expenses, categories]);

    const handleExportCSV = () => {
        const event = new CustomEvent("export-csv-click", { detail: "all-data" });
        window.dispatchEvent(event);
    };

    const handleExportPDF = () => {
        const event = new CustomEvent("export-pdf-click", { detail: "all-data" });
        window.dispatchEvent(event);
    };

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-primary/10 p-3">
                                <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{periodLabel}</p>
                                <p className="text-2xl font-bold">{formatCurrency(stats.periodTotal)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-blue-500/10 p-3">
                                <Receipt className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Expenses</p>
                                <p className="text-2xl font-bold">{stats.count}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-orange-500/10 p-3">
                                <Truck className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Truck Expenses</p>
                                <p className="text-2xl font-bold">{stats.withTrucks}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-green-500/10 p-3">
                                <MapPin className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Trip Expenses</p>
                                <p className="text-2xl font-bold">{stats.withTrips}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="rounded-lg border bg-card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b p-4">
                    {showAnalytics ? (
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                                <TabsTrigger value="expenses" className="gap-2">
                                    <List className="h-4 w-4" />
                                    <span className="hidden sm:inline">Expenses</span>
                                </TabsTrigger>
                                <TabsTrigger value="charts" className="gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Analytics</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    ) : (
                        <h2 className="flex items-center gap-2 text-sm font-medium">
                            <List className="h-4 w-4" />
                            Expenses
                        </h2>
                    )}

                    <div className="flex gap-2 w-full sm:w-auto">
                        {canExport && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                                        <Download className="mr-2 h-4 w-4" />
                                        Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleExportCSV}>
                                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                                        Export as CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportPDF}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Export as PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <Link href="/finance/expenses/new" className="flex-1 sm:flex-none">
                            <Button size="sm" className="w-full">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Expense
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="p-4">
                    <Tabs value={activeTab}>
                        <TabsContent value="expenses" className="mt-0">
                            <ExpensesTableClient expenses={expenses} />
                        </TabsContent>

                        {/* Not merely hidden: the charts fetch their own data,
                            so leaving the panel mounted would have a supervisor
                            pulling the by-category totals in the background. */}
                        {showAnalytics && (
                            <TabsContent value="charts" className="mt-0">
                                <ExpenseCharts categories={categories} />
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
