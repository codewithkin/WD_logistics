"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { EmployeeStatus } from "@/lib/types";
import { generateEmployeeReportPDF } from "@/lib/reports/pdf-report-generator";

export async function createEmployee(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  position: string;
  department?: string;
  image?: string;
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
    image?: string;
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

export async function exportEmployeesPDF(options?: {
  employeeIds?: string[];
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

    if (options?.employeeIds && options.employeeIds.length > 0) {
      whereClause.id = { in: options.employeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const employeeData = employees.map((emp) => ({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || "N/A",
      phone: emp.phone || "N/A",
      position: emp.position,
      department: emp.department || "N/A",
      status: emp.status,
      startDate: emp.startDate,
    }));

    // Count by department and position
    const byDepartment: { [key: string]: number } = {};
    const byPosition: { [key: string]: number } = {};
    employees.forEach((emp) => {
      const dept = emp.department || "N/A";
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
      byPosition[emp.position] = (byPosition[emp.position] || 0) + 1;
    });

    const analytics = {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.status === "active").length,
      byDepartment,
      byPosition,
    };

    const pdfBytes = generateEmployeeReportPDF({
      employees: employeeData,
      analytics,
      period: { startDate, endDate },
    });

    return {
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `employees-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export employees PDF:", error);
    return { success: false, error: "Failed to generate PDF report" };
  }
}
