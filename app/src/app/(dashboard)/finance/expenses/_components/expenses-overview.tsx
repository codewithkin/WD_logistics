"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, FileText, FileSpreadsheet, BarChart3, Settings } from "lucide-react";
import Link from "next/link";
import { ExpensesTable } from "./expenses-table";
import { ExpenseCharts } from "./expense-charts";
import { ExpenseCategoriesSection } from "./expense-categories-section";

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
}

export function ExpensesOverview({ categories }: ExpensesOverviewProps) {
    const [activeTab, setActiveTab] = useState("expenses");

    const handleExportPDF = () => {
        // PDF export will be handled by the active tab component
        const event = new CustomEvent("export-pdf");
        window.dispatchEvent(event);
    };

    const handleExportCSV = () => {
        // CSV export will be handled by the active tab component
        const event = new CustomEvent("export-csv");
        window.dispatchEvent(event);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                    <TabsList>
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="charts">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Charts
                        </TabsTrigger>
                        <TabsTrigger value="categories">
                            <Settings className="mr-2 h-4 w-4" />
                            Categories
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                    <Link href="/finance/expenses/new">
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Expense
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs value={activeTab} className="space-y-4">
                <TabsContent value="expenses" className="space-y-4">
                    <ExpensesTable />
                </TabsContent>

                <TabsContent value="charts" className="space-y-4">
                    <ExpenseCharts categories={categories} />
                </TabsContent>

                <TabsContent value="categories" className="space-y-4">
                    <ExpenseCategoriesSection categories={categories} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
