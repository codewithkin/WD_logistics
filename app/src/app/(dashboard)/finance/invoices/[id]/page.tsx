import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Pencil,
    Calendar,
    Building2,
    FileText,
    CreditCard,
    DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, PAYMENT_METHOD_LABELS, InvoiceStatus, PaymentMethod } from "@/lib/types";

interface InvoiceDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId },
        include: {
            customer: true,
            payments: {
                orderBy: { paymentDate: "desc" },
            },
        },
    });

    if (!invoice) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.total - totalPaid;
    const isOverdue =
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" &&
        new Date(invoice.dueDate) < new Date();

    return (
        <div>
            <PageHeader
                title={invoice.invoiceNumber}
                description={`Invoice for ${invoice.customer.name}`}
                backHref="/finance/invoices"
                action={
                    canEdit
                        ? {
                            label: "Edit Invoice",
                            href: `/finance/invoices/${invoice.id}/edit`,
                            icon: Pencil,
                        }
                        : undefined
                }
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge className={INVOICE_STATUS_COLORS[invoice.status as InvoiceStatus]}>
                                {INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus]}
                            </Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Issue Date
                            </span>
                            <span className="font-medium">{format(invoice.issueDate, "PPP")}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Due Date</span>
                            <span className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                                {format(invoice.dueDate, "PPP")}
                                {isOverdue && " (Overdue)"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="h-5 w-5" /> Customer
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Link
                                href={`/customers/${invoice.customer.id}`}
                                className="font-medium text-primary hover:underline text-lg"
                            >
                                {invoice.customer.name}
                            </Link>
                            {invoice.customer.email && (
                                <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
                            )}
                            {invoice.customer.phone && (
                                <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
                            )}
                        </div>
                        {invoice.customer.address && (
                            <>
                                <Separator />
                                <p className="text-sm text-muted-foreground">{invoice.customer.address}</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5" /> Amount Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">${invoice.subtotal.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="font-medium">${invoice.tax.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-bold text-lg">${invoice.total.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Paid</span>
                            <span className="font-medium text-green-600">${totalPaid.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Balance</span>
                            <span
                                className={`font-bold text-lg ${balance > 0 ? "text-amber-600" : "text-green-600"}`}
                            >
                                ${balance.toLocaleString()}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {invoice.notes && (
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Payments
                    </CardTitle>
                    {canEdit && balance > 0 && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/finance/payments/new?invoiceId=${invoice.id}`}>Record Payment</Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {invoice.payments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No payments recorded</p>
                    ) : (
                        <div className="space-y-3">
                            {invoice.payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                >
                                    <div>
                                        <p className="font-medium">${payment.amount.toLocaleString()}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(payment.paymentDate, "PPP")} •{" "}
                                            {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
                                        </p>
                                    </div>
                                    {payment.reference && (
                                        <span className="text-sm text-muted-foreground">Ref: {payment.reference}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
