"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesTable } from "./expenses-table";
import { ExpensesAnalytics } from "./expenses-analytics";
import { Role } from "@/lib/types";

interface Expense {
    id: string;
    description: string | null;
    amount: number;
    date: Date;
    receiptUrl: string | null;
    vendor: string | null;
    reference: string | null;
    category: {
        id: string;
        name: string;
    };
    tripExpenses: Array<{
        trip: {
            id: string;
            originCity: string;
            destinationCity: string;
            truck: {
                registrationNo: string;
            };
            driver: {
                firstName: string;
                lastName: string;
            };
        };
    }>;
}

interface Category {
    id: string;
    name: string;
    description: string | null;
    isTrip: boolean;
    isTruck: boolean;
    isDriver: boolean;
    color: string | null;
}

interface Analytics {
    totalExpenses: number;
    totalAmount: number;
    pendingExpenses: number;
    approvedExpenses: number;
    rejectedExpenses: number;
    paidExpenses: number;
    pendingAmount: number;
    paidAmount: number;
    categoryBreakdown: Array<{ name: string; count: number; amount: number }>;
}

interface ExpensesClientProps {
    expenses: Expense[];
    categories: Category[];
    analytics: Analytics;
    role: Role;
    canExport: boolean;
    periodLabel?: string;
}

export function ExpensesClient({ expenses, categories, analytics, role, canExport, periodLabel }: ExpensesClientProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    // Filter expenses based on selected category
    const filteredExpenses = useMemo(() => {
        if (selectedCategory === "all") {
            return expenses;
        }
        return expenses.filter((expense) => expense.category?.id === selectedCategory);
    }, [expenses, selectedCategory]);

    // Calculate analytics for filtered expenses
    const filteredAnalytics = useMemo(() => {
        const totalExpenses = filteredExpenses.length;
        const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        // Note: Expense model doesn't have status field, so we set these to 0
        const pendingExpenses = 0;
        const approvedExpenses = 0;
        const rejectedExpenses = 0;
        const paidExpenses = totalExpenses; // Assume all are paid
        const pendingAmount = 0;
        const paidAmount = totalAmount;

        // Get category breakdown
        const categoryBreakdown = filteredExpenses.reduce((acc, e) => {
            const catName = e.category?.name || "Uncategorized";
            if (!acc[catName]) {
                acc[catName] = { name: catName, count: 0, amount: 0 };
            }
            acc[catName].count += 1;
            acc[catName].amount += e.amount;
            return acc;
        }, {} as Record<string, { name: string; count: number; amount: number }>);

        return {
            totalExpenses,
            totalAmount,
            pendingExpenses,
            approvedExpenses,
            rejectedExpenses,
            paidExpenses,
            pendingAmount,
            paidAmount,
            categoryBreakdown: Object.values(categoryBreakdown),
        };
    }, [filteredExpenses]);

    // Get current category name for report
    const currentCategoryName = selectedCategory === "all"
        ? "All Categories"
        : categories.find(c => c.id === selectedCategory)?.name || "Unknown";

    // Transform expenses for ExpensesAnalytics (add default status)
    const analyticsExpenses = filteredExpenses.map(e => ({
        ...e,
        description: e.description || "",
        status: "paid" as const,
    }));

    return (
        <div className="space-y-6">
            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="all" className="px-4">
                        All Categories
                    </TabsTrigger>
                    {categories.map((category) => {
                        const count = expenses.filter(e => e.category?.id === category.id).length;
                        return (
                            <TabsTrigger
                                key={category.id}
                                value={category.id}
                                className="px-4"
                            >
                                {category.name} ({count})
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                <TabsContent value={selectedCategory} className="mt-6 space-y-6">
                    <ExpensesAnalytics
                        analytics={filteredAnalytics}
                        expenses={analyticsExpenses}
                        canExport={canExport}
                        categoryId={selectedCategory === "all" ? undefined : selectedCategory}
                        categoryName={currentCategoryName}
                        periodLabel={periodLabel}
                    />
                    <ExpensesTable expenses={filteredExpenses} role={role} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
