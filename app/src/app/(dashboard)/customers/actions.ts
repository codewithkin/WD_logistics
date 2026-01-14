"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { generateCustomerReportPDF } from "@/lib/reports/pdf-report-generator";
import { generateCustomerDetailReportWord } from "@/lib/reports/word-report-generator";

export async function createCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  notes?: string;
  status?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const customer = await prisma.customer.create({
      data: {
        ...data,
        status: data.status ?? "active",
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/customers");
    return { success: true, customer };
  } catch (error) {
    console.error("Failed to create customer:", error);
    return { success: false, error: "Failed to create customer" };
  }
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    notes?: string;
    status?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { success: true, customer: updatedCustomer };
  } catch (error) {
    console.error("Failed to update customer:", error);
    return { success: false, error: "Failed to update customer" };
  }
}

export async function deleteCustomer(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { trips: true, invoices: true },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    if (customer._count.trips > 0 || customer._count.invoices > 0) {
      return {
        success: false,
        error: "Cannot delete customer with associated trips or invoices",
      };
    }

    await prisma.customer.delete({ where: { id } });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return { success: false, error: "Failed to delete customer" };
  }
}

export async function exportCustomersPDF(options?: {
  customerIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await requireAuth();

  try {
    const startDate = options?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = options?.endDate || new Date();

    const whereClause: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (options?.customerIds && options.customerIds.length > 0) {
      whereClause.id = { in: options.customerIds };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        trips: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            id: true,
          },
        },
        invoices: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            id: true,
            total: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const customerData = customers.map((customer) => ({
      name: customer.name,
      contactPerson: customer.contactPerson || "N/A",
      email: customer.email || "N/A",
      phone: customer.phone || "N/A",
      address: customer.address || "N/A",
      trips: customer.trips.length,
      invoices: customer.invoices.length,
      totalRevenue: customer.invoices.reduce((sum, inv) => sum + inv.total, 0),
    }));

    const analytics = {
      totalCustomers: customers.length,
      customersWithTrips: customers.filter((c) => c.trips.length > 0).length,
      totalTrips: customers.reduce((sum, c) => sum + c.trips.length, 0),
      totalInvoices: customers.reduce((sum, c) => sum + c.invoices.length, 0),
      totalRevenue: customers.reduce(
        (sum, c) => sum + c.invoices.reduce((iSum, inv) => iSum + inv.total, 0),
        0
      ),
    };

    const pdfBytes = generateCustomerReportPDF({
      customers: customerData,
      analytics,
      period: { startDate, endDate },
    });

    return {
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `customer-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export customers PDF:", error);
    return { success: false, error: "Failed to generate PDF report" };
  }
}

export async function exportCustomerDetailWord(customerId: string) {
  const session = await requireAuth();

  try {
    // Fetch customer with all related data
    const customer = await prisma.customer.findFirst({
      where: { 
        id: customerId, 
        organizationId: session.organizationId,
      },
      include: {
        trips: {
          orderBy: { scheduledDate: "desc" },
          select: {
            id: true,
            originCity: true,
            destinationCity: true,
            status: true,
            scheduledDate: true,
            endDate: true,
            revenue: true,
          },
        },
        invoices: {
          orderBy: { issueDate: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            balance: true,
            status: true,
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            reference: true,
            invoice: {
              select: {
                invoiceNumber: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Get organization name
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    // Calculate summary
    const totalTrips = customer.trips.length;
    const totalInvoiced = customer.invoices.reduce((sum: number, inv) => sum + inv.total, 0);
    const totalPaid = customer.payments.reduce((sum: number, pay) => sum + pay.amount, 0);
    const totalOwed = Math.abs(Math.min(customer.balance, 0));

    const reportData = {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        status: customer.status,
        balance: customer.balance,
      },
      trips: customer.trips.map((t, index) => ({
        id: t.id,
        tripNumber: `TRP-${String(index + 1).padStart(4, "0")}`,
        origin: t.originCity,
        destination: t.destinationCity,
        status: t.status,
        startDate: t.scheduledDate,
        endDate: t.endDate,
        fare: t.revenue,
      })),
      invoices: customer.invoices,
      payments: customer.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        invoiceNumber: p.invoice.invoiceNumber,
      })),
      summary: {
        totalTrips,
        totalInvoiced,
        totalPaid,
        totalOwed,
      },
      generatedAt: new Date(),
      organizationName: organization?.name || "WD Logistics",
    };

    const docBytes = await generateCustomerDetailReportWord(reportData);
    const sanitizedName = customer.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    
    return {
      success: true,
      doc: Buffer.from(docBytes).toString("base64"),
      filename: `customer-report-${sanitizedName}-${new Date().toISOString().split("T")[0]}.docx`,
    };
  } catch (error) {
    console.error("Failed to export customer Word report:", error);
    return { success: false, error: "Failed to generate Word report" };
  }
}
