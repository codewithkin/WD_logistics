"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export type ExportScope = "current-page" | "all-data";

interface ExportOptionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (scope: ExportScope) => void;
    currentPageCount: number;
    totalCount: number;
    isLoading?: boolean;
}

export function ExportOptionsDialog({
    open,
    onOpenChange,
    onExport,
    currentPageCount,
    totalCount,
    isLoading = false,
}: ExportOptionsDialogProps) {
    const [selectedScope, setSelectedScope] = useState<ExportScope>("current-page");

    const handleExport = () => {
        onExport(selectedScope);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                    <DialogDescription>
                        Choose what data to include in your export
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <RadioGroup value={selectedScope} onValueChange={(value) => setSelectedScope(value as ExportScope)}>
                        <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent" onClick={() => setSelectedScope("current-page")}>
                            <RadioGroupItem value="current-page" id="current-page" className="mt-1" />
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="current-page" className="font-medium cursor-pointer">
                                    Current Page Only
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Export only the {currentPageCount} items shown on this page
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent" onClick={() => setSelectedScope("all-data")}>
                            <RadioGroupItem value="all-data" id="all-data" className="mt-1" />
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="all-data" className="font-medium cursor-pointer">
                                    All Data
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Export all {totalCount} items (may be large)
                                </p>
                            </div>
                        </div>
                    </RadioGroup>

                    {selectedScope === "all-data" && totalCount > 100 && (
                        <div className="flex gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <p>
                                Large exports may take a moment to generate. This will include all {totalCount} items.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isLoading}
                    >
                        {isLoading ? "Exporting..." : "Export"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
