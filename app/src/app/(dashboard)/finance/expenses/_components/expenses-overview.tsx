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
import { ExpensesTableClient } from "./expenses-table-client";
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

interface Expense {
    id: string;
    amount: number;
    description: string | null;
    date: Date;
    category: {
        id: string;
        name: string;
        color: string | null;
    };
    truckExpenses: Array<{
        truck: {
            registrationNo: string;
        };
    }>;
    tripExpenses: Array<{
        trip: {
            originCity: string;
            destinationCity: string;
        };
    }>;
    driverExpenses?: Array<{
        driver: {
            firstName: string;
            lastName: string;
        };
    }>;
}

interface ExpensesOverviewProps {
    categories: Category[];
    expenses: Expense[];
}

export function ExpensesOverview({ categories, expenses }: ExpensesOverviewProps) {
    const [activeTab, setActiveTab] = useState("expenses");
    const tableRef = useState<any>(null)[1];

    // Calculate summary stats
    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = expenses.filter(e => {
            const expDate = new Date(e.date);
            return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        });
        const thisMonthTotal = thisMonth.reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const withTrucks = expenses.filter(e => e.truckExpenses.length > 0).length;
        const withTrips = expenses.filter(e => e.tripExpenses.length > 0).length;

        return {
            total: totalExpenses,
            thisMonth: thisMonthTotal,
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
                                <p className="text-sm text-muted-foreground">This Month</p>
                                <p className="text-2xl font-bold">{formatCurrency(stats.thisMonth)}</p>
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

                    <div className="flex gap-2 w-full sm:w-auto">
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

                        <TabsContent value="charts" className="mt-0">
                            <ExpenseCharts categories={categories} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
