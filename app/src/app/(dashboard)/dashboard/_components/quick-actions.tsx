"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Truck, UserPlus, Users, ChevronDown, Receipt } from "lucide-react";
import Link from "next/link";
import { CreateSupervisorDialog } from "../../users/_components/create-supervisor-dialog";

interface QuickActionsProps {
    role: string;
}

export function QuickActions({ role }: QuickActionsProps) {
    const isAdmin = role === "admin";

    return (
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Primary Action: New Trip */}
            <Button asChild className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105">
                <Link href="/operations/trips/new">
                    <Truck className="h-4 w-4 mr-2" />
                    New Trip
                </Link>
            </Button>

            {/* Add People Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-md">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add
                        <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <DropdownMenuItem asChild className="cursor-pointer transition-colors duration-200">
                        <Link href="/fleet/drivers/new" className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            New Driver
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer transition-colors duration-200">
                        <Link href="/employees/new" className="flex items-center">
                            <UserPlus className="h-4 w-4 mr-2" />
                            New Employee
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer transition-colors duration-200">
                        <Link href="/finance/expenses/new" className="flex items-center">
                            <Receipt className="h-4 w-4 mr-2" />
                            Record Expense
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Admin Only: Add Supervisor */}
            {isAdmin && <CreateSupervisorDialog />}
        </div>
    );
}
