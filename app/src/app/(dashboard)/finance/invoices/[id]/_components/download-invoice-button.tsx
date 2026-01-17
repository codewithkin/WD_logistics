"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadSingleInvoicePDF } from "../../actions";
import { toast } from "sonner";

interface DownloadInvoiceButtonProps {
  invoiceId: string;
}

export function DownloadInvoiceButton({ invoiceId }: DownloadInvoiceButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDownload() {
    setIsLoading(true);
    try {
      const result = await downloadSingleInvoicePDF(invoiceId);
      if (result.success && result.data) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename || "invoice.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success("Invoice PDF downloaded successfully");
      } else {
        toast.error(result.error || "Failed to download invoice");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download invoice PDF");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Download PDF
    </Button>
  );
}
