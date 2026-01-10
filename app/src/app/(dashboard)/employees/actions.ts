"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmployeeStatus } from "@/lib/types";

export async function createEmployee(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  position: string;
  department?: string;
  status: EmployeeStatus;
  startDate: Date;
  salary?: number;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    if (data.email) {
      const existing = await prisma.employee.findFirst({
        where: { email: data.email, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false, error: "Email already exists" };
      }
    }

    const employee = await prisma.employee.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/employees");
    return { success: true, employee };
  } catch (error) {
    console.error("Failed to create employee:", error);
    return { success: false, error: "Failed to create employee" };
  }
}

export async function updateEmployee(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
    status?: EmployeeStatus;
    startDate?: Date;
    endDate?: Date | null;
    salary?: number;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    if (data.email && data.email !== employee.email) {
      const existing = await prisma.employee.findFirst({
        where: { email: data.email, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false, error: "Email already exists" };
      }
    }

    // Auto-set end date when status is terminated
    if (data.status === "terminated" && !data.endDate) {
      data.endDate = new Date();
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { success: true, employee: updatedEmployee };
  } catch (error) {
    console.error("Failed to update employee:", error);
    return { success: false, error: "Failed to update employee" };
  }
}

export async function deleteEmployee(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    await prisma.employee.delete({ where: { id } });

    revalidatePath("/employees");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return { success: false, error: "Failed to delete employee" };
  }
}
