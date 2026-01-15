"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageOpen, Users, DollarSign, AlertTriangle, Receipt } from "lucide-react";

interface SupplierCardsProps {
    totalSuppliers: number;
    activeSuppliers: number;
    totalOwing: number;
    suppliersWithOwing: number;
    periodTotalExpenses?: number;
    periodLabel?: string;
}

export function SupplierCards({
    totalSuppliers,
    activeSuppliers,
    totalOwing,
    suppliersWithOwing,
    periodTotalExpenses = 0,
    periodLabel = "This Month",
}: SupplierCardsProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
                    <PackageOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalSuppliers}</div>
                    <p className="text-xs text-muted-foreground">
                        All registered suppliers
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{activeSuppliers}</div>
                    <p className="text-xs text-muted-foreground">
                        Currently active
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Owing</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(totalOwing)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Amount owed to suppliers
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Suppliers Owed</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{suppliersWithOwing}</div>
                    <p className="text-xs text-muted-foreground">
                        Suppliers with outstanding balance
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Period Expenses</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-amber-600">
                        {formatCurrency(periodTotalExpenses)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {periodLabel}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
