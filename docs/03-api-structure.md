# WD Logistics - API Structure

## Overview

This document outlines the API structure for WD Logistics using Next.js App Router API routes with role-based access control.

## API Architecture

```
/api
├── /auth                    # better-auth endpoints
│   └── [...all]
├── /organization
│   ├── GET                  # Get current organization
│   └── PUT                  # Update organization (Admin only)
├── /users
│   ├── GET                  # List users (Admin only)
│   ├── POST                 # Create user (Admin only)
│   └── /[id]
│       ├── GET              # Get user details (Admin only)
│       ├── PUT              # Update user (Admin only)
│       └── DELETE           # Delete user (Admin only)
├── /trucks
│   ├── GET                  # List trucks
│   ├── POST                 # Create truck (Admin, Supervisor)
│   └── /[id]
│       ├── GET              # Get truck details
│       ├── PUT              # Update truck (Admin, Supervisor)
│       ├── DELETE           # Delete truck (Admin, Supervisor)
│       └── /expenses        # Get truck expenses
├── /drivers
│   ├── GET                  # List drivers
│   ├── POST                 # Create driver (Admin, Supervisor)
│   └── /[id]
│       ├── GET              # Get driver details
│       ├── PUT              # Update driver (Admin, Supervisor)
│       └── DELETE           # Delete driver (Admin, Supervisor)
├── /employees
│   ├── GET                  # List employees
│   ├── POST                 # Create employee (Admin only)
│   └── /[id]
│       ├── GET              # Get employee details
│       ├── PUT              # Update employee (Admin only)
│       └── DELETE           # Delete employee (Admin only)
├── /customers
│   ├── GET                  # List customers
│   ├── POST                 # Create customer (Admin, Supervisor)
│   └── /[id]
│       ├── GET              # Get customer details
│       ├── PUT              # Update customer (Admin, Supervisor)
│       ├── DELETE           # Delete customer (Admin, Supervisor)
│       ├── /invoices        # Get customer invoices
│       ├── /payments        # Get customer payments
│       └── /statement       # Generate customer statement
├── /trips
│   ├── GET                  # List trips
│   ├── POST                 # Create trip (All roles)
│   └── /[id]
│       ├── GET              # Get trip details
│       ├── PUT              # Update trip (Admin, Supervisor)
│       ├── DELETE           # Delete trip (Admin, Supervisor)
│       ├── /expenses        # Get/Add trip expenses
│       └── /notify          # Send driver notification
├── /expenses
│   ├── GET                  # List expenses
│   ├── POST                 # Create expense (All roles)
│   └── /[id]
│       ├── GET              # Get expense details
│       ├── PUT              # Update expense (Admin, Supervisor)
│       └── DELETE           # Delete expense (Admin, Supervisor)
├── /expense-categories
│   ├── GET                  # List categories
│   ├── POST                 # Create category (Admin)
│   └── /[id]
│       ├── PUT              # Update category (Admin)
│       └── DELETE           # Delete category (Admin)
├── /invoices
│   ├── GET                  # List invoices
│   ├── POST                 # Create invoice (Admin, Supervisor)
│   └── /[id]
│       ├── GET              # Get invoice details
│       ├── PUT              # Update invoice (Admin, Supervisor)
│       ├── DELETE           # Delete invoice (Admin, Supervisor)
│       ├── /pdf             # Generate invoice PDF
│       └── /reminder        # Send payment reminder
├── /payments
│   ├── GET                  # List payments
│   ├── POST                 # Record payment (All roles)
│   └── /[id]
│       ├── GET              # Get payment details
│       ├── PUT              # Update payment (Admin, Supervisor)
│       └── DELETE           # Delete payment (Admin, Supervisor)
├── /inventory
│   ├── GET                  # List inventory items
│   ├── POST                 # Add inventory item (Admin, Supervisor)
│   └── /[id]
│       ├── GET              # Get item details
│       ├── PUT              # Update item (Admin, Supervisor)
│       ├── DELETE           # Delete item (Admin, Supervisor)
│       └── /allocate        # Allocate part to truck (All roles)
├── /allocations
│   ├── GET                  # List part allocations
│   └── /[id]
│       └── GET              # Get allocation details
├── /edit-requests
│   ├── GET                  # List edit requests
│   ├── POST                 # Create edit request (Staff)
│   └── /[id]
│       ├── GET              # Get request details
│       ├── /approve         # Approve request (Admin)
│       └── /reject          # Reject request (Admin)
├── /reports
│   ├── GET                  # List generated reports (Admin)
│   ├── /generate            # Generate new report (Admin)
│   │   ├── /profit-per-unit
│   │   ├── /revenue
│   │   ├── /expenses
│   │   ├── /overall
│   │   ├── /tires
│   │   ├── /customer-statement
│   │   ├── /trip-summary
│   │   └── /truck-performance
│   └── /[id]
│       ├── GET              # Get report details (Admin)
│       └── /download        # Download report (Admin)
├── /notifications
│   ├── GET                  # List notification history
│   └── /send                # Send WhatsApp notification
└── /dashboard
    ├── /stats               # Dashboard statistics
    ├── /recent-trips        # Recent trips
    ├── /pending-requests    # Pending edit requests (Admin)
    └── /alerts              # System alerts
```

## API Implementation Examples

### Base API Helper

```typescript
// lib/api-helpers.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Role = "admin" | "supervisor" | "staff";

interface AuthContext {
  user: any;
  member: any;
  role: Role;
  organizationId: string;
}

export async function withAuth(
  request: NextRequest,
  handler: (context: AuthContext) => Promise<NextResponse>,
  options?: { roles?: Role[] }
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get organization membership
    const member = await prisma.member.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No organization membership" },
        { status: 403 }
      );
    }

    const role = member.role.toLowerCase() as Role;

    // Check role access
    if (options?.roles && !options.roles.includes(role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return handler({
      user: session.user,
      member,
      role,
      organizationId: member.organizationId,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Trucks API Example

```typescript
// app/api/trucks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

// GET /api/trucks - List all trucks
export async function GET(request: NextRequest) {
  return withAuth(request, async ({ organizationId }) => {
    const trucks = await prisma.truck.findMany({
      where: { organizationId },
      include: {
        assignedDriver: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { registrationNo: "asc" },
    });

    return NextResponse.json(trucks);
  });
}

// POST /api/trucks - Create a new truck
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async ({ organizationId }) => {
      const body = await request.json();

      const truck = await prisma.truck.create({
        data: {
          organizationId,
          registrationNo: body.registrationNo,
          make: body.make,
          model: body.model,
          year: body.year,
          chassisNumber: body.chassisNumber,
          engineNumber: body.engineNumber,
          status: body.status || "ACTIVE",
          currentMileage: body.currentMileage || 0,
          fuelType: body.fuelType,
          tankCapacity: body.tankCapacity,
          image: body.image,
          notes: body.notes,
        },
      });

      return NextResponse.json(truck, { status: 201 });
    },
    { roles: ["admin", "supervisor"] }
  );
}
```

```typescript
// app/api/trucks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

// GET /api/trucks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async ({ organizationId }) => {
    const truck = await prisma.truck.findFirst({
      where: {
        id: params.id,
        organizationId,
      },
      include: {
        assignedDriver: true,
        trips: {
          take: 10,
          orderBy: { scheduledDate: "desc" },
        },
        expenses: {
          include: {
            expense: {
              include: { category: true },
            },
          },
          take: 20,
          orderBy: { expense: { date: "desc" } },
        },
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: "Truck not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(truck);
  });
}

// PUT /api/trucks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(
    request,
    async ({ organizationId }) => {
      const body = await request.json();

      const truck = await prisma.truck.update({
        where: {
          id: params.id,
          organizationId,
        },
        data: {
          registrationNo: body.registrationNo,
          make: body.make,
          model: body.model,
          year: body.year,
          chassisNumber: body.chassisNumber,
          engineNumber: body.engineNumber,
          status: body.status,
          currentMileage: body.currentMileage,
          fuelType: body.fuelType,
          tankCapacity: body.tankCapacity,
          image: body.image,
          notes: body.notes,
        },
      });

      return NextResponse.json(truck);
    },
    { roles: ["admin", "supervisor"] }
  );
}

// DELETE /api/trucks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(
    request,
    async ({ organizationId }) => {
      await prisma.truck.delete({
        where: {
          id: params.id,
          organizationId,
        },
      });

      return NextResponse.json({ success: true });
    },
    { roles: ["admin", "supervisor"] }
  );
}
```

### Edit Request API (For Staff Edits)

```typescript
// app/api/edit-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

// GET /api/edit-requests
export async function GET(request: NextRequest) {
  return withAuth(request, async ({ role, user }) => {
    const where = role === "staff" 
      ? { requestedById: user.id }  // Staff sees only their requests
      : {};  // Admin/Supervisor see all

    const requests = await prisma.editRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  });
}

// POST /api/edit-requests - Create edit request (Staff only)
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async ({ user }) => {
      const body = await request.json();

      // Fetch original data
      let originalData: any;
      switch (body.entityType) {
        case "truck":
          originalData = await prisma.truck.findUnique({
            where: { id: body.entityId },
          });
          break;
        case "driver":
          originalData = await prisma.driver.findUnique({
            where: { id: body.entityId },
          });
          break;
        case "expense":
          originalData = await prisma.expense.findUnique({
            where: { id: body.entityId },
          });
          break;
        // Add more entity types as needed
        default:
          return NextResponse.json(
            { error: "Invalid entity type" },
            { status: 400 }
          );
      }

      if (!originalData) {
        return NextResponse.json(
          { error: "Entity not found" },
          { status: 404 }
        );
      }

      const editRequest = await prisma.editRequest.create({
        data: {
          entityType: body.entityType,
          entityId: body.entityId,
          originalData,
          proposedData: body.proposedData,
          reason: body.reason,
          requestedById: user.id,
          status: "PENDING",
        },
      });

      return NextResponse.json(editRequest, { status: 201 });
    },
    { roles: ["staff"] }
  );
}
```

```typescript
// app/api/edit-requests/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

// POST /api/edit-requests/[id]/approve
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(
    request,
    async ({ user }) => {
      const editRequest = await prisma.editRequest.findUnique({
        where: { id: params.id },
      });

      if (!editRequest) {
        return NextResponse.json(
          { error: "Edit request not found" },
          { status: 404 }
        );
      }

      if (editRequest.status !== "PENDING") {
        return NextResponse.json(
          { error: "Request already processed" },
          { status: 400 }
        );
      }

      // Apply the edit based on entity type
      const proposedData = editRequest.proposedData as any;

      switch (editRequest.entityType) {
        case "truck":
          await prisma.truck.update({
            where: { id: editRequest.entityId },
            data: proposedData,
          });
          break;
        case "driver":
          await prisma.driver.update({
            where: { id: editRequest.entityId },
            data: proposedData,
          });
          break;
        case "expense":
          await prisma.expense.update({
            where: { id: editRequest.entityId },
            data: proposedData,
          });
          break;
        // Add more entity types
      }

      // Update the edit request
      const updated = await prisma.editRequest.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
        },
      });

      return NextResponse.json(updated);
    },
    { roles: ["admin"] }
  );
}
```

### Reports API

```typescript
// app/api/reports/generate/profit-per-unit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { generateProfitPerUnitPDF, generateProfitPerUnitCSV } from "@/lib/reports";

// POST /api/reports/generate/profit-per-unit
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async ({ organizationId, user }) => {
      const body = await request.json();
      const { startDate, endDate, format, period } = body;

      // Fetch data for the report
      const trucks = await prisma.truck.findMany({
        where: { organizationId },
        include: {
          trips: {
            where: {
              status: "COMPLETED",
              endDate: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            },
            include: {
              expenses: {
                include: {
                  expense: true,
                },
              },
            },
          },
          expenses: {
            where: {
              expense: {
                date: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              },
            },
            include: {
              expense: {
                include: { category: true },
              },
            },
          },
        },
      });

      // Calculate profit per unit
      const profitData = trucks.map((truck) => {
        const totalRevenue = truck.trips.reduce(
          (sum, trip) => sum + trip.revenue,
          0
        );

        const tripExpenses = truck.trips.reduce(
          (sum, trip) =>
            sum +
            trip.expenses.reduce((e, te) => e + te.expense.amount, 0),
          0
        );

        const truckExpenses = truck.expenses.reduce(
          (sum, te) => sum + te.expense.amount,
          0
        );

        const totalExpenses = tripExpenses + truckExpenses;
        const profit = totalRevenue - totalExpenses;

        return {
          truckId: truck.id,
          registrationNo: truck.registrationNo,
          make: truck.make,
          model: truck.model,
          trips: truck.trips.length,
          revenue: totalRevenue,
          expenses: totalExpenses,
          profit,
          profitMargin: totalRevenue > 0 
            ? ((profit / totalRevenue) * 100).toFixed(2) 
            : 0,
        };
      });

      // Generate report file
      let fileUrl: string;
      if (format === "PDF") {
        fileUrl = await generateProfitPerUnitPDF(profitData, {
          startDate,
          endDate,
          period,
        });
      } else {
        fileUrl = await generateProfitPerUnitCSV(profitData, {
          startDate,
          endDate,
          period,
        });
      }

      // Save report record
      const report = await prisma.report.create({
        data: {
          organizationId,
          type: "PROFIT_PER_UNIT",
          period: period.toUpperCase(),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          format,
          fileUrl,
          generatedById: user.id,
        },
      });

      return NextResponse.json({
        report,
        data: profitData,
      });
    },
    { roles: ["admin"] }
  );
}
```

## API Response Formats

### Success Response

```typescript
// Single resource
{
  "id": "clx123...",
  "registrationNo": "AEU-29",
  "make": "Volvo",
  "model": "FH16",
  // ... other fields
}

// List of resources
[
  { "id": "clx123...", ... },
  { "id": "clx456...", ... },
]

// Paginated list
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```typescript
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional details
}
```

## Rate Limiting & Security

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
});

export async function rateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  return {
    success,
    headers: {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    },
  };
}
```

## Validation with Zod

```typescript
// lib/validations/truck.ts
import { z } from "zod";

export const createTruckSchema = z.object({
  registrationNo: z.string().min(1, "Registration number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  status: z.enum(["ACTIVE", "IN_SERVICE", "IN_REPAIR", "INACTIVE", "DECOMMISSIONED"]).optional(),
  currentMileage: z.number().min(0).optional(),
  fuelType: z.string().optional(),
  tankCapacity: z.number().positive().optional(),
  image: z.string().url().optional(),
  notes: z.string().optional(),
});

export const updateTruckSchema = createTruckSchema.partial();

export type CreateTruckInput = z.infer<typeof createTruckSchema>;
export type UpdateTruckInput = z.infer<typeof updateTruckSchema>;
```
