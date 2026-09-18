"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileType, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportCustomerDetailPDF, exportCustomerDetailWord } from "../../actions";

interface ExportCustomerButtonProps {
    customerId: string;
    customerName: string;
}

const MIME = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

function download(base64: string, filename: string, mime: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const url = URL.createObjectURL(new Blob([new Uint8Array(byteNumbers)], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * The customer detail page had no export at all — Word was only reachable
 * from the list page's row menu, and PDF only as part of the whole-list
 * report.
 */
export function ExportCustomerButton({ customerId, customerName }: ExportCustomerButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const fallbackName = customerName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

    const handleExport = async (format: "pdf" | "docx") => {
        setIsLoading(true);
        try {
            const result =
                format === "pdf"
                    ? await exportCustomerDetailPDF(customerId)
                    : await exportCustomerDetailWord(customerId);

            if (!result.success) {
                toast.error(result.error || "Failed to export customer report");
                return;
            }

            const payload = "pdf" in result ? result.pdf : result.doc;
            download(
                payload,
                result.filename || `customer-report-${fallbackName}.${format}`,
                MIME[format]
            );
            toast.success("Customer report exported successfully");
        } catch {
            toast.error("Failed to export customer report");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Report
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("docx")}>
                    <FileType className="mr-2 h-4 w-4" />
                    Export as Word
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
