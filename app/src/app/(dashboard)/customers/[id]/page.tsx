import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Mail, Phone, MapPin, User, FileText, DollarSign, Truck } from "lucide-react";
import { format } from "date-fns";

interface CustomerDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const customer = await prisma.customer.findFirst({
        where: { id, organizationId },
        include: {
            trips: {
                orderBy: { startDate: "desc" },
                take: 5,
                include: {
                    truck: true,
                    driver: true,
                },
            },
            invoices: {
                orderBy: { issueDate: "desc" },
                take: 5,
            },
        },
    });

    if (!customer) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";

    // Calculate totals
    const totalRevenue = customer.trips.reduce((sum, trip) => sum + trip.revenue, 0);
    const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + inv.total, 0);

    return (
        <div>
            <PageHeader
                title={customer.name}
                description="Customer details"
                backHref="/customers"
                action={
                    canEdit
                        ? {
                            label: "Edit Customer",
                            href: `/customers/${customer.id}/edit`,
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
                            <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                                {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                            </Badge>
                        </div>
                        {customer.contactPerson && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <User className="h-4 w-4" /> Contact Person
                                    </span>
                                    <span className="font-medium">{customer.contactPerson}</span>
                                </div>
                            </>
                        )}
                        {customer.email && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" /> Email
                                    </span>
                                    <a
                                        href={`mailto:${customer.email}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {customer.email}
                                    </a>
                                </div>
                            </>
                        )}
                        {customer.phone && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Phone className="h-4 w-4" /> Phone
                                    </span>
                                    <span className="font-medium">{customer.phone}</span>
                                </div>
                            </>
                        )}
                        {customer.address && (
                            <>
                                <Separator />
                                <div className="flex items-start justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <MapPin className="h-4 w-4" /> Address
                                    </span>
                                    <span className="font-medium text-right max-w-[60%]">{customer.address}</span>
                                </div>
                            </>
                        )}
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
                            <span className="text-muted-foreground">Total Trips</span>
                            <span className="font-medium">{customer.trips.length}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Revenue</span>
                            <span className="font-medium text-green-600">
                                ${totalRevenue.toLocaleString()}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Invoiced</span>
                            <span className="font-medium">${totalInvoiced.toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {customer.notes && (
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid gap-6 mt-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="h-5 w-5" /> Recent Trips
                        </CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/operations/trips?customerId=${customer.id}`}>View All</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {customer.trips.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No trips recorded</p>
                        ) : (
                            <div className="space-y-3">
                                {customer.trips.map((trip) => (
                                    <div
                                        key={trip.id}
                                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <Link
                                                href={`/operations/trips/${trip.id}`}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {trip.originCity} → {trip.destinationCity}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {format(trip.scheduledDate, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <span className="font-medium">${trip.revenue.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Recent Invoices</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/finance/invoices?customerId=${customer.id}`}>View All</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {customer.invoices.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No invoices created</p>
                        ) : (
                            <div className="space-y-3">
                                {customer.invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <Link
                                                href={`/finance/invoices/${invoice.id}`}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {invoice.invoiceNumber}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {format(invoice.issueDate, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-medium">
                                                ${invoice.total.toLocaleString()}
                                            </span>
                                            <Badge variant="outline" className="ml-2">
                                                {invoice.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
