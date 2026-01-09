# WD Logistics - AI Agent Integration

## Overview

This document outlines the AI Agent integration using Mastra.ai (local MCP server) and wweb-js for WhatsApp notifications. The AI Agent has access to ALL business data in the application for intelligent assistance and automated notifications.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WD LOGISTICS AI AGENT                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    MASTRA.AI MCP SERVER                        │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │  │
│  │  │   Tools     │  │   Memory    │  │   Workflows         │    │  │
│  │  │             │  │             │  │                     │    │  │
│  │  │ - DB Access │  │ - Context   │  │ - Trip Notify       │    │  │
│  │  │ - Trip Mgmt │  │ - History   │  │ - Invoice Remind    │    │  │
│  │  │ - Notify    │  │ - User Pref │  │ - Daily Summary     │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘    │  │
│  │                                                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        WWEB-JS                                  │  │
│  │              WhatsApp Web Integration                           │  │
│  │                                                                 │  │
│  │  - Send messages to drivers                                     │  │
│  │  - Invoice reminders to customers                               │  │
│  │  - Trip assignments                                             │  │
│  │  - Payment confirmations                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    BUSINESS DATA ACCESS                         │  │
│  │                                                                 │  │
│  │  - Trucks, Drivers, Employees                                   │  │
│  │  - Trips, Expenses, Invoices                                    │  │
│  │  - Customers, Payments, Inventory                               │  │
│  │  - Reports, Analytics                                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Mastra.ai Configuration

### Installation

```bash
npm install @mastra/core @mastra/engine
```

### Mastra Setup

```typescript
// lib/mastra/index.ts
import { Mastra } from "@mastra/core";
import { PostgresEngine } from "@mastra/engine";
import { prisma } from "@/lib/prisma";

// Import tools
import { truckTools } from "./tools/trucks";
import { tripTools } from "./tools/trips";
import { driverTools } from "./tools/drivers";
import { customerTools } from "./tools/customers";
import { expenseTools } from "./tools/expenses";
import { invoiceTools } from "./tools/invoices";
import { notificationTools } from "./tools/notifications";
import { reportTools } from "./tools/reports";

// Import workflows
import { tripNotificationWorkflow } from "./workflows/trip-notification";
import { invoiceReminderWorkflow } from "./workflows/invoice-reminder";
import { dailySummaryWorkflow } from "./workflows/daily-summary";

export const mastra = new Mastra({
  engine: new PostgresEngine({
    connectionString: process.env.DATABASE_URL!,
  }),
  
  tools: {
    ...truckTools,
    ...tripTools,
    ...driverTools,
    ...customerTools,
    ...expenseTools,
    ...invoiceTools,
    ...notificationTools,
    ...reportTools,
  },
  
  workflows: {
    tripNotification: tripNotificationWorkflow,
    invoiceReminder: invoiceReminderWorkflow,
    dailySummary: dailySummaryWorkflow,
  },
  
  systemPrompt: `
You are the WD Logistics AI Assistant. You have full access to the company's business data including:
- Fleet information (trucks, drivers)
- Trip management
- Customer data
- Financial data (invoices, payments, expenses)
- Inventory and parts
- Employee information

Your role is to:
1. Help staff find information quickly
2. Send notifications to drivers about trip assignments
3. Send invoice reminders to customers
4. Provide insights and summaries
5. Assist with operational decisions

Always be professional and concise. When providing financial data, format numbers clearly.
For sensitive operations like sending notifications, always confirm before executing.
  `,
});
```

## AI Tools Definition

### Database Access Tools

```typescript
// lib/mastra/tools/trucks.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const truckTools = {
  getTruck: createTool({
    name: "getTruck",
    description: "Get details of a specific truck by registration number or ID",
    inputSchema: z.object({
      identifier: z.string().describe("Truck registration number or ID"),
    }),
    execute: async ({ identifier }, { organizationId }) => {
      const truck = await prisma.truck.findFirst({
        where: {
          organizationId,
          OR: [
            { id: identifier },
            { registrationNo: identifier },
          ],
        },
        include: {
          assignedDriver: true,
          trips: {
            take: 5,
            orderBy: { scheduledDate: "desc" },
          },
        },
      });
      
      if (!truck) {
        return { error: "Truck not found" };
      }
      
      return truck;
    },
  }),

  listTrucks: createTool({
    name: "listTrucks",
    description: "List all trucks with optional status filter",
    inputSchema: z.object({
      status: z.enum(["ACTIVE", "IN_SERVICE", "IN_REPAIR", "INACTIVE"]).optional(),
    }),
    execute: async ({ status }, { organizationId }) => {
      const trucks = await prisma.truck.findMany({
        where: {
          organizationId,
          ...(status && { status }),
        },
        include: {
          assignedDriver: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { registrationNo: "asc" },
      });
      
      return {
        count: trucks.length,
        trucks: trucks.map(t => ({
          id: t.id,
          registration: t.registrationNo,
          makeModel: `${t.make} ${t.model}`,
          status: t.status,
          driver: t.assignedDriver 
            ? `${t.assignedDriver.firstName} ${t.assignedDriver.lastName}`
            : "Unassigned",
        })),
      };
    },
  }),

  getTruckPerformance: createTool({
    name: "getTruckPerformance",
    description: "Get performance metrics for a truck over a time period",
    inputSchema: z.object({
      truckId: z.string(),
      startDate: z.string().describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ truckId, startDate, endDate }, { organizationId }) => {
      const truck = await prisma.truck.findFirst({
        where: { id: truckId, organizationId },
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
                include: { expense: true },
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
              expense: { include: { category: true } },
            },
          },
        },
      });

      if (!truck) {
        return { error: "Truck not found" };
      }

      const totalTrips = truck.trips.length;
      const totalRevenue = truck.trips.reduce((sum, t) => sum + t.revenue, 0);
      const totalMileage = truck.trips.reduce((sum, t) => sum + (t.actualMileage || 0), 0);
      
      const tripExpenses = truck.trips.reduce(
        (sum, t) => sum + t.expenses.reduce((e, te) => e + te.expense.amount, 0),
        0
      );
      const directExpenses = truck.expenses.reduce(
        (sum, te) => sum + te.expense.amount,
        0
      );
      const totalExpenses = tripExpenses + directExpenses;
      const profit = totalRevenue - totalExpenses;

      return {
        truck: truck.registrationNo,
        period: `${startDate} to ${endDate}`,
        metrics: {
          totalTrips,
          totalMileage,
          totalRevenue: `$${totalRevenue.toFixed(2)}`,
          totalExpenses: `$${totalExpenses.toFixed(2)}`,
          profit: `$${profit.toFixed(2)}`,
          profitMargin: `${((profit / totalRevenue) * 100).toFixed(1)}%`,
          revenuePerTrip: `$${(totalRevenue / totalTrips).toFixed(2)}`,
        },
      };
    },
  }),
};
```

### Trip Tools

```typescript
// lib/mastra/tools/trips.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const tripTools = {
  getTrip: createTool({
    name: "getTrip",
    description: "Get details of a specific trip",
    inputSchema: z.object({
      tripId: z.string(),
    }),
    execute: async ({ tripId }, { organizationId }) => {
      const trip = await prisma.trip.findFirst({
        where: { id: tripId, organizationId },
        include: {
          truck: true,
          driver: true,
          customer: true,
          expenses: {
            include: {
              expense: { include: { category: true } },
            },
          },
        },
      });
      
      return trip || { error: "Trip not found" };
    },
  }),

  listUpcomingTrips: createTool({
    name: "listUpcomingTrips",
    description: "List upcoming scheduled trips",
    inputSchema: z.object({
      days: z.number().default(7).describe("Number of days to look ahead"),
    }),
    execute: async ({ days }, { organizationId }) => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const trips = await prisma.trip.findMany({
        where: {
          organizationId,
          status: "SCHEDULED",
          scheduledDate: {
            gte: new Date(),
            lte: endDate,
          },
        },
        include: {
          truck: { select: { registrationNo: true } },
          driver: { select: { firstName: true, lastName: true, whatsappNumber: true } },
          customer: { select: { name: true } },
        },
        orderBy: { scheduledDate: "asc" },
      });

      return {
        count: trips.length,
        trips: trips.map(t => ({
          id: t.id,
          date: t.scheduledDate.toISOString().split("T")[0],
          route: `${t.originCity} → ${t.destinationCity}`,
          truck: t.truck.registrationNo,
          driver: `${t.driver.firstName} ${t.driver.lastName}`,
          driverNotified: t.driverNotified,
          customer: t.customer?.name || "N/A",
          estimatedMileage: t.estimatedMileage,
        })),
      };
    },
  }),

  getTripsNeedingNotification: createTool({
    name: "getTripsNeedingNotification",
    description: "Get trips where drivers haven't been notified yet",
    inputSchema: z.object({}),
    execute: async (_, { organizationId }) => {
      const trips = await prisma.trip.findMany({
        where: {
          organizationId,
          status: "SCHEDULED",
          driverNotified: false,
          scheduledDate: {
            gte: new Date(),
          },
        },
        include: {
          truck: { select: { registrationNo: true } },
          driver: { select: { firstName: true, lastName: true, whatsappNumber: true } },
        },
        orderBy: { scheduledDate: "asc" },
      });

      return {
        count: trips.length,
        trips: trips.map(t => ({
          id: t.id,
          date: t.scheduledDate.toISOString().split("T")[0],
          route: `${t.originCity} → ${t.destinationCity}`,
          truck: t.truck.registrationNo,
          driver: `${t.driver.firstName} ${t.driver.lastName}`,
          driverPhone: t.driver.whatsappNumber,
        })),
      };
    },
  }),

  createTrip: createTool({
    name: "createTrip",
    description: "Create a new trip",
    inputSchema: z.object({
      truckId: z.string(),
      driverId: z.string(),
      customerId: z.string().optional(),
      originCity: z.string(),
      destinationCity: z.string(),
      scheduledDate: z.string(),
      estimatedMileage: z.number(),
      loadDescription: z.string().optional(),
      revenue: z.number().optional(),
    }),
    execute: async (input, { organizationId }) => {
      const trip = await prisma.trip.create({
        data: {
          organizationId,
          ...input,
          scheduledDate: new Date(input.scheduledDate),
          status: "SCHEDULED",
        },
        include: {
          truck: true,
          driver: true,
        },
      });

      return {
        success: true,
        message: `Trip created: ${trip.originCity} → ${trip.destinationCity}`,
        tripId: trip.id,
        driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
        truck: trip.truck.registrationNo,
      };
    },
  }),
};
```

### Notification Tools

```typescript
// lib/mastra/tools/notifications.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const notificationTools = {
  sendTripNotification: createTool({
    name: "sendTripNotification",
    description: "Send a WhatsApp notification to a driver about their trip assignment",
    inputSchema: z.object({
      tripId: z.string(),
      customMessage: z.string().optional().describe("Optional custom message to include"),
    }),
    execute: async ({ tripId, customMessage }, { organizationId }) => {
      const trip = await prisma.trip.findFirst({
        where: { id: tripId, organizationId },
        include: {
          truck: true,
          driver: true,
          customer: true,
        },
      });

      if (!trip) {
        return { error: "Trip not found" };
      }

      if (!trip.driver.whatsappNumber) {
        return { error: "Driver does not have a WhatsApp number" };
      }

      // Format the message
      const message = formatTripNotificationMessage(trip, customMessage);

      // Send via wweb-js
      const result = await sendWhatsAppMessage(
        trip.driver.whatsappNumber,
        message
      );

      if (result.success) {
        // Update trip as notified
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            driverNotified: true,
            notifiedAt: new Date(),
          },
        });

        // Log notification
        await prisma.notification.create({
          data: {
            type: "TRIP_ASSIGNMENT",
            recipientPhone: trip.driver.whatsappNumber,
            message,
            status: "SENT",
            sentAt: new Date(),
            metadata: { tripId },
          },
        });

        return {
          success: true,
          message: `Notification sent to ${trip.driver.firstName} ${trip.driver.lastName}`,
        };
      } else {
        await prisma.notification.create({
          data: {
            type: "TRIP_ASSIGNMENT",
            recipientPhone: trip.driver.whatsappNumber,
            message,
            status: "FAILED",
            error: result.error,
            metadata: { tripId },
          },
        });

        return { error: result.error };
      }
    },
  }),

  sendInvoiceReminder: createTool({
    name: "sendInvoiceReminder",
    description: "Send a payment reminder for an overdue invoice",
    inputSchema: z.object({
      invoiceId: z.string(),
    }),
    execute: async ({ invoiceId }, { organizationId }) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: {
          customer: true,
        },
      });

      if (!invoice) {
        return { error: "Invoice not found" };
      }

      if (!invoice.customer.phone) {
        return { error: "Customer does not have a phone number" };
      }

      const message = formatInvoiceReminderMessage(invoice);

      const result = await sendWhatsAppMessage(
        invoice.customer.phone,
        message
      );

      if (result.success) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            reminderSent: true,
            reminderSentAt: new Date(),
          },
        });

        await prisma.notification.create({
          data: {
            type: "INVOICE_REMINDER",
            recipientPhone: invoice.customer.phone,
            message,
            status: "SENT",
            sentAt: new Date(),
            metadata: { invoiceId },
          },
        });

        return {
          success: true,
          message: `Reminder sent to ${invoice.customer.name}`,
        };
      }

      return { error: result.error };
    },
  }),

  sendBulkTripNotifications: createTool({
    name: "sendBulkTripNotifications",
    description: "Send notifications to all drivers with unnotified upcoming trips",
    inputSchema: z.object({
      daysAhead: z.number().default(3).describe("Notify drivers for trips within this many days"),
    }),
    execute: async ({ daysAhead }, { organizationId }) => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);

      const trips = await prisma.trip.findMany({
        where: {
          organizationId,
          status: "SCHEDULED",
          driverNotified: false,
          scheduledDate: {
            gte: new Date(),
            lte: endDate,
          },
        },
        include: {
          truck: true,
          driver: true,
        },
      });

      const results = {
        total: trips.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        details: [] as any[],
      };

      for (const trip of trips) {
        if (!trip.driver.whatsappNumber) {
          results.skipped++;
          results.details.push({
            tripId: trip.id,
            status: "skipped",
            reason: "No WhatsApp number",
          });
          continue;
        }

        const message = formatTripNotificationMessage(trip);
        const sendResult = await sendWhatsAppMessage(
          trip.driver.whatsappNumber,
          message
        );

        if (sendResult.success) {
          await prisma.trip.update({
            where: { id: trip.id },
            data: {
              driverNotified: true,
              notifiedAt: new Date(),
            },
          });
          results.sent++;
          results.details.push({
            tripId: trip.id,
            driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
            status: "sent",
          });
        } else {
          results.failed++;
          results.details.push({
            tripId: trip.id,
            driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
            status: "failed",
            error: sendResult.error,
          });
        }
      }

      return results;
    },
  }),
};

// Message formatting helpers
function formatTripNotificationMessage(trip: any, customMessage?: string): string {
  const dateStr = new Date(trip.scheduledDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let message = `🚛 *WD LOGISTICS - TRIP ASSIGNMENT*\n\n`;
  message += `Hello ${trip.driver.firstName},\n\n`;
  message += `You have been assigned a new trip:\n\n`;
  message += `📅 *Date:* ${dateStr}\n`;
  message += `🚗 *Truck:* ${trip.truck.registrationNo}\n`;
  message += `📍 *Route:* ${trip.originCity} → ${trip.destinationCity}\n`;
  message += `📏 *Est. Distance:* ${trip.estimatedMileage} km\n`;

  if (trip.loadDescription) {
    message += `📦 *Load:* ${trip.loadDescription}\n`;
  }

  if (trip.customer) {
    message += `🏢 *Customer:* ${trip.customer.name}\n`;
  }

  if (customMessage) {
    message += `\n💬 ${customMessage}\n`;
  }

  message += `\n_Please confirm receipt of this assignment._\n`;
  message += `\n— WD Logistics Team`;

  return message;
}

function formatInvoiceReminderMessage(invoice: any): string {
  const dueDate = new Date(invoice.dueDate).toLocaleDateString();
  const daysOverdue = Math.floor(
    (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  let message = `📋 *WD LOGISTICS - PAYMENT REMINDER*\n\n`;
  message += `Dear ${invoice.customer.name},\n\n`;
  message += `This is a friendly reminder regarding invoice *${invoice.invoiceNumber}*.\n\n`;
  message += `💰 *Amount Due:* $${invoice.balance.toFixed(2)}\n`;
  message += `📅 *Due Date:* ${dueDate}\n`;

  if (daysOverdue > 0) {
    message += `⚠️ *Days Overdue:* ${daysOverdue}\n`;
  }

  message += `\nPlease arrange payment at your earliest convenience.\n`;
  message += `\nFor any queries, please contact us.\n`;
  message += `\n— WD Logistics Accounts`;

  return message;
}
```

### Customer & Invoice Tools

```typescript
// lib/mastra/tools/customers.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const customerTools = {
  getCustomer: createTool({
    name: "getCustomer",
    description: "Get customer details and account status",
    inputSchema: z.object({
      identifier: z.string().describe("Customer name or ID"),
    }),
    execute: async ({ identifier }, { organizationId }) => {
      const customer = await prisma.customer.findFirst({
        where: {
          organizationId,
          OR: [
            { id: identifier },
            { name: { contains: identifier, mode: "insensitive" } },
          ],
        },
        include: {
          invoices: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { issueDate: "desc" },
            take: 10,
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 10,
          },
        },
      });

      if (!customer) {
        return { error: "Customer not found" };
      }

      const totalInvoiced = customer.invoices.reduce((sum, i) => sum + i.total, 0);
      const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
      const overdueInvoices = customer.invoices.filter(
        (i) => i.status === "OVERDUE"
      ).length;

      return {
        id: customer.id,
        name: customer.name,
        contact: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        account: {
          balance: `$${customer.balance.toFixed(2)}`,
          totalInvoiced: `$${totalInvoiced.toFixed(2)}`,
          totalPaid: `$${totalPaid.toFixed(2)}`,
          overdueInvoices,
        },
        recentInvoices: customer.invoices.map((i) => ({
          number: i.invoiceNumber,
          date: i.issueDate.toISOString().split("T")[0],
          total: `$${i.total.toFixed(2)}`,
          status: i.status,
        })),
      };
    },
  }),

  getOverdueInvoices: createTool({
    name: "getOverdueInvoices",
    description: "Get all overdue invoices that need follow-up",
    inputSchema: z.object({
      daysOverdue: z.number().optional().describe("Minimum days overdue"),
    }),
    execute: async ({ daysOverdue = 0 }, { organizationId }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ["OVERDUE", "SENT", "PARTIAL"] },
          dueDate: { lt: cutoffDate },
          balance: { gt: 0 },
        },
        include: {
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      const totalOverdue = invoices.reduce((sum, i) => sum + i.balance, 0);

      return {
        count: invoices.length,
        totalOverdue: `$${totalOverdue.toFixed(2)}`,
        invoices: invoices.map((i) => {
          const daysOver = Math.floor(
            (Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: i.id,
            number: i.invoiceNumber,
            customer: i.customer.name,
            customerPhone: i.customer.phone,
            balance: `$${i.balance.toFixed(2)}`,
            dueDate: i.dueDate.toISOString().split("T")[0],
            daysOverdue: daysOver,
            reminderSent: i.reminderSent,
          };
        }),
      };
    },
  }),
};

// lib/mastra/tools/invoices.ts
export const invoiceTools = {
  getInvoiceDetails: createTool({
    name: "getInvoiceDetails",
    description: "Get detailed information about a specific invoice",
    inputSchema: z.object({
      invoiceId: z.string(),
    }),
    execute: async ({ invoiceId }, { organizationId }) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: {
          customer: true,
          lineItems: true,
          payments: true,
        },
      });

      if (!invoice) {
        return { error: "Invoice not found" };
      }

      return {
        ...invoice,
        subtotal: `$${invoice.subtotal.toFixed(2)}`,
        tax: `$${invoice.tax.toFixed(2)}`,
        total: `$${invoice.total.toFixed(2)}`,
        amountPaid: `$${invoice.amountPaid.toFixed(2)}`,
        balance: `$${invoice.balance.toFixed(2)}`,
      };
    },
  }),
};
```

### Report & Analytics Tools

```typescript
// lib/mastra/tools/reports.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const reportTools = {
  getDailySummary: createTool({
    name: "getDailySummary",
    description: "Get a summary of today's operations",
    inputSchema: z.object({
      date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
    }),
    execute: async ({ date }, { organizationId }) => {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const [tripsStarted, tripsCompleted, expenses, payments, newTrips] = await Promise.all([
        prisma.trip.count({
          where: {
            organizationId,
            status: "IN_PROGRESS",
            startDate: { gte: startOfDay, lte: endOfDay },
          },
        }),
        prisma.trip.count({
          where: {
            organizationId,
            status: "COMPLETED",
            endDate: { gte: startOfDay, lte: endOfDay },
          },
        }),
        prisma.expense.aggregate({
          where: {
            organizationId,
            date: { gte: startOfDay, lte: endOfDay },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payment.aggregate({
          where: {
            invoice: { organizationId },
            paymentDate: { gte: startOfDay, lte: endOfDay },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.trip.count({
          where: {
            organizationId,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        }),
      ]);

      return {
        date: startOfDay.toISOString().split("T")[0],
        operations: {
          tripsStarted,
          tripsCompleted,
          newTripsScheduled: newTrips,
        },
        financial: {
          expensesRecorded: expenses._count,
          totalExpenses: `$${(expenses._sum.amount || 0).toFixed(2)}`,
          paymentsReceived: payments._count,
          totalPayments: `$${(payments._sum.amount || 0).toFixed(2)}`,
        },
      };
    },
  }),

  getFleetUtilization: createTool({
    name: "getFleetUtilization",
    description: "Get current fleet utilization statistics",
    inputSchema: z.object({}),
    execute: async (_, { organizationId }) => {
      const trucks = await prisma.truck.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      });

      const total = trucks.reduce((sum, t) => sum + t._count, 0);
      const active = trucks.find((t) => t.status === "ACTIVE")?._count || 0;

      const tripsInProgress = await prisma.trip.count({
        where: {
          organizationId,
          status: "IN_PROGRESS",
        },
      });

      return {
        totalTrucks: total,
        utilization: {
          active,
          inService: trucks.find((t) => t.status === "IN_SERVICE")?._count || 0,
          inRepair: trucks.find((t) => t.status === "IN_REPAIR")?._count || 0,
          inactive: trucks.find((t) => t.status === "INACTIVE")?._count || 0,
        },
        tripsInProgress,
        utilizationRate: `${((tripsInProgress / total) * 100).toFixed(1)}%`,
      };
    },
  }),

  getExpenseBreakdown: createTool({
    name: "getExpenseBreakdown",
    description: "Get expense breakdown by category for a time period",
    inputSchema: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    execute: async ({ startDate, endDate }, { organizationId }) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        include: {
          category: true,
        },
      });

      const byCategory = expenses.reduce((acc, exp) => {
        const cat = exp.category.name;
        if (!acc[cat]) {
          acc[cat] = { count: 0, total: 0 };
        }
        acc[cat].count++;
        acc[cat].total += exp.amount;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        period: `${startDate} to ${endDate}`,
        totalExpenses: `$${totalExpenses.toFixed(2)}`,
        expenseCount: expenses.length,
        breakdown: Object.entries(byCategory)
          .map(([category, data]) => ({
            category,
            count: data.count,
            total: `$${data.total.toFixed(2)}`,
            percentage: `${((data.total / totalExpenses) * 100).toFixed(1)}%`,
          }))
          .sort((a, b) => parseFloat(b.total.slice(1)) - parseFloat(a.total.slice(1))),
      };
    },
  }),
};
```

## WhatsApp Integration (wweb-js)

### Installation & Setup

```bash
npm install whatsapp-web.js qrcode-terminal
```

### WhatsApp Client

```typescript
// lib/whatsapp/index.ts
import { Client, LocalAuth, Message } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

class WhatsAppService {
  private client: Client | null = null;
  private isReady: boolean = false;
  private qrCode: string | null = null;

  async initialize() {
    if (this.client) {
      return;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: ".wwebjs_auth",
      }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    this.client.on("qr", (qr) => {
      this.qrCode = qr;
      console.log("WhatsApp QR Code generated. Scan to authenticate:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      this.isReady = true;
      this.qrCode = null;
      console.log("WhatsApp client is ready!");
    });

    this.client.on("authenticated", () => {
      console.log("WhatsApp client authenticated");
    });

    this.client.on("auth_failure", (error) => {
      console.error("WhatsApp authentication failed:", error);
      this.isReady = false;
    });

    this.client.on("disconnected", (reason) => {
      console.log("WhatsApp client disconnected:", reason);
      this.isReady = false;
    });

    await this.client.initialize();
  }

  async sendMessage(
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isReady || !this.client) {
      return { success: false, error: "WhatsApp client is not ready" };
    }

    try {
      // Format phone number (remove + and add @c.us)
      const formattedNumber = phoneNumber.replace(/\D/g, "") + "@c.us";

      // Check if number is registered
      const isRegistered = await this.client.isRegisteredUser(formattedNumber);
      if (!isRegistered) {
        return { success: false, error: "Phone number is not on WhatsApp" };
      }

      const sentMessage = await this.client.sendMessage(formattedNumber, message);

      return {
        success: true,
        messageId: sentMessage.id.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to send message",
      };
    }
  }

  getStatus(): { ready: boolean; qrCode: string | null } {
    return {
      ready: this.isReady,
      qrCode: this.qrCode,
    };
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService();

// Export convenience function
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return whatsappService.sendMessage(phoneNumber, message);
}
```

### WhatsApp API Routes

```typescript
// app/api/whatsapp/status/route.ts
import { NextResponse } from "next/server";
import { whatsappService } from "@/lib/whatsapp";

export async function GET() {
  const status = whatsappService.getStatus();
  return NextResponse.json(status);
}

// app/api/whatsapp/initialize/route.ts
import { NextResponse } from "next/server";
import { whatsappService } from "@/lib/whatsapp";
import { withAuth } from "@/lib/api-helpers";

export async function POST(request: Request) {
  return withAuth(
    request,
    async () => {
      await whatsappService.initialize();
      return NextResponse.json({ success: true, message: "Initialization started" });
    },
    { roles: ["admin"] }
  );
}
```

## Workflows

### Trip Notification Workflow

```typescript
// lib/mastra/workflows/trip-notification.ts
import { createWorkflow, Step } from "@mastra/core";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const tripNotificationWorkflow = createWorkflow({
  name: "tripNotification",
  description: "Notify drivers about upcoming trip assignments",
  
  trigger: {
    type: "schedule",
    cron: "0 8 * * *", // Run daily at 8 AM
  },
  
  steps: [
    new Step({
      id: "fetchTrips",
      name: "Fetch unnotified trips",
      execute: async ({ context }) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        const trips = await prisma.trip.findMany({
          where: {
            organizationId: context.organizationId,
            status: "SCHEDULED",
            driverNotified: false,
            scheduledDate: {
              gte: new Date(),
              lte: tomorrow,
            },
          },
          include: {
            truck: true,
            driver: true,
            customer: true,
          },
        });

        return { trips };
      },
    }),
    
    new Step({
      id: "sendNotifications",
      name: "Send WhatsApp notifications",
      execute: async ({ previousStep }) => {
        const { trips } = previousStep.output;
        const results = [];

        for (const trip of trips) {
          if (!trip.driver.whatsappNumber) {
            results.push({
              tripId: trip.id,
              status: "skipped",
              reason: "No WhatsApp number",
            });
            continue;
          }

          const message = formatTripMessage(trip);
          const result = await sendWhatsAppMessage(
            trip.driver.whatsappNumber,
            message
          );

          if (result.success) {
            await prisma.trip.update({
              where: { id: trip.id },
              data: {
                driverNotified: true,
                notifiedAt: new Date(),
              },
            });
          }

          results.push({
            tripId: trip.id,
            driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
            status: result.success ? "sent" : "failed",
            error: result.error,
          });
        }

        return { results };
      },
    }),
  ],
});

function formatTripMessage(trip: any): string {
  // Message formatting logic
  return `🚛 WD Logistics Trip Assignment\n\n...`;
}
```

### Invoice Reminder Workflow

```typescript
// lib/mastra/workflows/invoice-reminder.ts
import { createWorkflow, Step } from "@mastra/core";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const invoiceReminderWorkflow = createWorkflow({
  name: "invoiceReminder",
  description: "Send reminders for overdue invoices",
  
  trigger: {
    type: "schedule",
    cron: "0 9 * * 1,3,5", // Mon, Wed, Fri at 9 AM
  },
  
  steps: [
    new Step({
      id: "fetchOverdueInvoices",
      name: "Fetch overdue invoices",
      execute: async ({ context }) => {
        const invoices = await prisma.invoice.findMany({
          where: {
            organizationId: context.organizationId,
            status: { in: ["OVERDUE", "SENT"] },
            dueDate: { lt: new Date() },
            balance: { gt: 0 },
            OR: [
              { reminderSent: false },
              {
                reminderSentAt: {
                  lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                },
              },
            ],
            maxReminderDate: {
              gte: new Date(), // Only if max date hasn't passed
            },
          },
          include: {
            customer: true,
          },
        });

        return { invoices };
      },
    }),
    
    new Step({
      id: "sendReminders",
      name: "Send reminder messages",
      execute: async ({ previousStep }) => {
        const { invoices } = previousStep.output;
        const results = [];

        for (const invoice of invoices) {
          if (!invoice.customer.phone) {
            results.push({
              invoiceId: invoice.id,
              status: "skipped",
              reason: "No phone number",
            });
            continue;
          }

          const message = formatReminderMessage(invoice);
          const result = await sendWhatsAppMessage(
            invoice.customer.phone,
            message
          );

          if (result.success) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                reminderSent: true,
                reminderSentAt: new Date(),
                status: "OVERDUE",
              },
            });
          }

          results.push({
            invoiceId: invoice.id,
            customer: invoice.customer.name,
            status: result.success ? "sent" : "failed",
          });
        }

        return { results };
      },
    }),
  ],
});
```

## AI Chat Interface

```tsx
// components/ai/ai-chat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bot, User, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: messages,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          WD Logistics AI Assistant
        </h3>
        <p className="text-sm text-muted-foreground">
          Ask about trucks, trips, customers, finances, and more
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>How can I help you today?</p>
              <p className="text-sm mt-2">Try asking:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"Show me today's scheduled trips"</li>
                <li>"Which invoices are overdue?"</li>
                <li>"What's the status of truck AEU-29?"</li>
                <li>"Send notifications to drivers for tomorrow's trips"</li>
              </ul>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your fleet, trips, customers..."
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
```

## AI Chat API Route

```typescript
// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { mastra } from "@/lib/mastra";

export async function POST(request: NextRequest) {
  return withAuth(request, async ({ organizationId, user }) => {
    const { message, history } = await request.json();

    const response = await mastra.chat({
      message,
      history,
      context: {
        organizationId,
        userId: user.id,
        userName: user.name,
      },
    });

    return NextResponse.json({ response: response.text });
  });
}
```

## Security Considerations

1. **Data Access Control**: The AI agent respects the user's role permissions
2. **Sensitive Actions**: Operations like sending notifications require confirmation
3. **Audit Logging**: All AI actions are logged for accountability
4. **Rate Limiting**: Prevent abuse of the AI chat endpoint
5. **WhatsApp Validation**: Validate phone numbers before sending messages
