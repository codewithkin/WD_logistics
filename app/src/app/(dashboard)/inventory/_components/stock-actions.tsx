"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PackageMinus, PackagePlus } from "lucide-react";
import { StockMovementDialog, type StockDialogMode } from "./stock-movement-dialog";

interface StockActionsProps {
    item: { id: string; name: string; quantity: number; unit: string | null; unitCost: number | null };
    /** Money values are admin-only, same rule as the rest of the Inventory pages. */
    showValue?: boolean;
}

export function StockActions({ item, showValue = false }: StockActionsProps) {
    const [mode, setMode] = useState<StockDialogMode | null>(null);

    return (
        <>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    onClick={() => setMode("out")}
                    disabled={item.quantity === 0}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                    <PackageMinus className="mr-2 h-4 w-4" />
                    Take Out Stock
                </Button>
                <Button variant="outline" onClick={() => setMode("in")}>
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Add Stock
                </Button>
            </div>
            <StockMovementDialog
                mode={mode ?? "out"}
                item={item}
                showValue={showValue}
                open={mode !== null}
                onOpenChange={(open) => !open && setMode(null)}
            />
        </>
    );
}
