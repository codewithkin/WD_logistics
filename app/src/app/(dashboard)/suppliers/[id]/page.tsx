import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pencil, Mail, Phone, MapPin, User, DollarSign, Receipt, Calendar, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { MarkExpensePaidButton } from "./_components/mark-expense-paid-button";

interface SupplierDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const supplier = await prisma.supplier.findFirst({
        where: { id, organizationId },
        include: {
            expenses: {
                orderBy: { date: "desc" },
                include: {
                    category: true,
                },
            },
        },
    });

    if (!supplier) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";

    // Calculate totals
    const unpaidExpenses = supplier.expenses.filter((e) => !e.isPaid);
    const paidExpenses = supplier.expenses.filter((e) => e.isPaid);
    const totalOwing = unpaidExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = supplier.expenses.reduce((sum, e) => sum + e.amount, 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={supplier.name}
                description="Supplier details and expenses"
                backHref="/suppliers"
                action={
                    canEdit
                        ? {
                            label: "Edit Supplier",
                            href: `/suppliers/${supplier.id}/edit`,
                            icon: Pencil,
                        }
                        : undefined
                }
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={supplier.status} type="customer" />
                        </div>
                        {supplier.contactPerson && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <User className="h-4 w-4" /> Contact Person
                                    </span>
                                    <span className="font-medium">{supplier.contactPerson}</span>
                                </div>
                            </>
                        )}
                        {supplier.email && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" /> Email
                                    </span>
                                    <a
                                        href={`mailto:${supplier.email}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {supplier.email}
                                    </a>
                                </div>
                            </>
                        )}
                        {supplier.phone && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Phone className="h-4 w-4" /> Phone
                                    </span>
                                    <span className="font-medium">{supplier.phone}</span>
                                </div>
                            </>
                        )}
                        {supplier.address && (
                            <>
                                <Separator />
                                <div className="flex items-start justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <MapPin className="h-4 w-4" /> Address
                                    </span>
                                    <span className="font-medium text-right max-w-[60%]">{supplier.address}</span>
                                </div>
                            </>
                        )}
                        {supplier.taxId && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Tax ID / VAT</span>
                                    <span className="font-medium">{supplier.taxId}</span>
                                </div>
                            </>
                        )}
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Payment Terms
                            </span>
                            <span className="font-medium">{supplier.paymentTerms} days</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5" /> Financial Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Expenses</span>
                            <span className="font-medium">{supplier.expenses.length}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Amount</span>
                            <span className="font-medium">
                                {formatCurrency(totalExpenses)}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Paid</span>
                            <span className="font-medium text-green-600">
                                {formatCurrency(totalPaid)}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Amount Owing</span>
                            <span className="font-bold text-lg text-red-600">
                                {formatCurrency(totalOwing)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {supplier.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5" /> Business Expenses
                    </CardTitle>
                    {canEdit && (
                        <Link
                            href={`/finance/expenses/new?supplier=${supplier.id}&business=true`}
                            className="text-sm text-primary hover:underline"
                        >
                            + Add Expense
                        </Link>
                    )}
                </CardHeader>
                <CardContent>
                    {supplier.expenses.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No expenses recorded for this supplier
                        </p>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        {canEdit && <TableHead className="w-[100px]"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {supplier.expenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>
                                                {format(new Date(expense.date), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>{expense.description || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {expense.category.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(expense.amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {expense.isPaid ? (
                                                    <Badge variant="default" className="bg-green-600">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        Paid
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">Unpaid</Badge>
                                                )}
                                            </TableCell>
                                            {canEdit && (
                                                <TableCell>
                                                    {!expense.isPaid && (
                                                        <MarkExpensePaidButton expenseId={expense.id} />
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/50 font-medium">
                                        <TableCell colSpan={3}>Total</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(totalExpenses)}
                                        </TableCell>
                                        <TableCell colSpan={canEdit ? 2 : 1}></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
