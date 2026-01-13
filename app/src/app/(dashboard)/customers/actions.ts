"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { generateCustomerReportPDF } from "@/lib/reports/pdf-report-generator";

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
