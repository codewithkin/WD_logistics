"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ExpenseCategory {
    id: string;
    name: string;
    description: string | null;
    isTrip: boolean;
    isTruck: boolean;
    color: string | null;
    _count: {
        expenses: number;
    };
}

interface ExpenseCategoriesTableClientProps {
    categories: ExpenseCategory[];
}

export function ExpenseCategoriesTableClient({ categories }: ExpenseCategoriesTableClientProps) {
    const router = useRouter();

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Expenses</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {categories.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                No expense categories found
                            </TableCell>
                        </TableRow>
                    ) : (
                        categories.map((category) => (
                            <TableRow key={category.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {category.color && (
                                            <div
                                                className="h-4 w-4 rounded-full"
                                                style={{ backgroundColor: category.color }}
                                            />
                                        )}
                                        <span className="font-medium">{category.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{category.description || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        {category.isTrip && <Badge variant="secondary">Trip</Badge>}
                                        {category.isTruck && <Badge variant="secondary">Truck</Badge>}
                                        {!category.isTrip && !category.isTruck && (
                                            <Badge variant="outline">General</Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{category._count.expenses}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/finance/expense-categories/${category.id}/edit`}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
