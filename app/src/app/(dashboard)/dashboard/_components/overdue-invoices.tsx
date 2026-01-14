import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle } from "lucide-react";

interface Invoice {
    id: string;
    invoiceNumber: string;
    total: number;
    balance: number;
    dueDate: Date | null;
    customer: { name: string };
}

interface OverdueInvoicesProps {
    invoices: Invoice[];
}

export function OverdueInvoices({ invoices }: OverdueInvoicesProps) {
    const totalOverdue = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    return (
        <Card className="border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Invoices
                </CardTitle>
                <Link href="/finance/invoices?status=overdue">
                    <Button variant="ghost" size="sm">
                        View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                <div className="mb-4 p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Overdue Amount</p>
                    <p className="text-2xl font-bold text-destructive">
                        ${totalOverdue.toLocaleString()}
                    </p>
                </div>

                <div className="space-y-3">
                    {invoices.map((invoice) => (
                        <div
                            key={invoice.id}
                            className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                        >
                            <div>
                                <p className="font-medium">{invoice.invoiceNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                    {invoice.customer.name}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-destructive">
                                    ${invoice.balance.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
