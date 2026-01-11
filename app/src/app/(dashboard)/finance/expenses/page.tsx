import { PageHeader } from "@/components/layout/page-header";
import { ExpensesTable } from "./_components/expenses-table";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, Settings, Truck, MapPin } from "lucide-react";
import Link from "next/link";

export default async function ExpensesPage() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expenses"
                description="Track and manage all business expenses"
                action={
                    <div className="flex flex-wrap gap-2">
                        <Link href="/finance/expenses/by-truck">
                            <Button variant="outline" size="sm">
                                <Truck className="mr-2 h-4 w-4" />
                                By Truck
                            </Button>
                        </Link>
                        <Link href="/finance/expenses/by-trip">
                            <Button variant="outline" size="sm">
                                <MapPin className="mr-2 h-4 w-4" />
                                By Trip
                            </Button>
                        </Link>
                        <Link href="/finance/expenses/analytics">
                            <Button variant="outline" size="sm">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Analytics
                            </Button>
                        </Link>
                        <Link href="/finance/expense-categories">
                            <Button variant="outline" size="sm">
                                <Settings className="mr-2 h-4 w-4" />
                                Categories
                            </Button>
                        </Link>
                        <Link href="/finance/expenses/new">
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Expense
                            </Button>
                        </Link>
                    </div>
                }
            />
            <ExpensesTable />
        </div>
    );
}
