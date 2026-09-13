"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { SidebarNavContent } from "@/components/layout/sidebar";

interface MobileSidebarProps {
    pendingEditRequests?: number;
    showExpenses?: boolean;
}

/**
 * Hamburger-triggered nav drawer for small screens. Renders the same nav
 * content as the desktop Sidebar (see sidebar.tsx) inside a Sheet instead of
 * a permanent column — only visible below the `lg` breakpoint, matching
 * where Sidebar hides itself.
 */
export function MobileSidebar({ pendingEditRequests = 0, showExpenses = false }: MobileSidebarProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0"
                aria-label="Open navigation menu"
                onClick={() => setOpen(true)}
            >
                <Menu className="h-5 w-5" />
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="left" className="w-72 p-0 gap-0">
                    {/* Visually hidden — Radix Dialog requires a title for screen readers */}
                    <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                    <SheetDescription className="sr-only">
                        App navigation links
                    </SheetDescription>
                    <SidebarNavContent
                        pendingEditRequests={pendingEditRequests}
                        showExpenses={showExpenses}
                        onNavigate={() => setOpen(false)}
                    />
                </SheetContent>
            </Sheet>
        </>
    );
}
