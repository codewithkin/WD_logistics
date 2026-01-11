"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Truck, UserPlus, Users, ChevronDown } from "lucide-react";
import Link from "next/link";

interface QuickActionsProps {
    role: string;
}

export function QuickActions({ role }: QuickActionsProps) {
    const isAdmin = role === "admin";

    return (
        <div className="flex items-center gap-3">
            {/* Primary Action: New Trip */}
            <Button asChild>
                <Link href="/operations/trips/new">
                    <Truck className="h-4 w-4 mr-2" />
                    New Trip
                </Link>
            </Button>

            {/* Add People Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add
                        <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href="/fleet/drivers/new" className="flex items-center cursor-pointer">
                            <Users className="h-4 w-4 mr-2" />
                            New Driver
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/employees/new" className="flex items-center cursor-pointer">
                            <UserPlus className="h-4 w-4 mr-2" />
                            New Employee
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Admin Only: Add Supervisor */}
            {isAdmin && (
                <Button variant="secondary" asChild>
                    <Link href="/users/new-supervisor">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supervisor
                    </Link>
                </Button>
            )}
        </div>
    );
}
