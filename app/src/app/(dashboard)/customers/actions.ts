"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

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
