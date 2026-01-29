/**
 * Cron Job: Automated Invoice Payment Reminders
 * 
 * GET /api/cron/invoice-reminders
 * 
 * This endpoint should be called by a cron scheduler (e.g., Vercel Cron, 
 * Railway Cron, or external service like cron-job.org) once daily.
 * 
 * It finds invoices that:
 * 1. Are due today (send "due today" reminder)
 * 2. Are overdue (send overdue reminder)
 * 3. Haven't had a reminder sent in the last 7 days
 * 4. Haven't exceeded their maxReminderDate
 * 
 * Sends notifications via WhatsApp and Email.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceReminderEmail } from "@/lib/email";
import { format } from "date-fns";

const CRON_SECRET = process.env.CRON_SECRET;
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured (for security)
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find invoices that need reminders
    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ["sent", "partial", "overdue"],
        },
        balance: {
          gt: 0,
        },
        dueDate: {
          lte: today, // Due today or overdue
        },
        // Only send if no reminder in the last 7 days
        OR: [
          { reminderSent: false },
          {
            reminderSentAt: {
              lt: sevenDaysAgo,
            },
          },
        ],
        // Respect max reminder date if set
        AND: [
          {
            OR: [
              { maxReminderDate: null },
              { maxReminderDate: { gte: today } },
            ],
          },
        ],
      },
      include: {
        customer: true,
        organization: true,
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 50, // Process in batches to avoid timeout
    });

    const results = {
      processed: 0,
      whatsappSent: 0,
      emailSent: 0,
      errors: [] as string[],
    };

    for (const invoice of invoices) {
      const isOverdue = invoice.dueDate !== null && invoice.dueDate < today;
      const daysOverdue = isOverdue && invoice.dueDate
        ? Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Send WhatsApp Reminder via Agent
      if (invoice.customer.phone) {
        try {
          const response = await fetch(`${AGENT_URL}/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId: invoice.organizationId,
              phoneNumber: invoice.customer.phone,
              message: `📋 *Payment ${isOverdue ? 'Overdue' : 'Reminder'}*

Dear ${invoice.customer.name},

${isOverdue 
  ? `Your invoice is *${daysOverdue} days overdue*:`
  : 'This is a friendly reminder about your upcoming invoice:'}

📄 *Invoice #:* ${invoice.invoiceNumber}
💰 *Balance Due:* $${invoice.balance.toFixed(2)}
📅 *Due Date:* ${invoice.dueDate ? format(invoice.dueDate, "PPP") : "N/A"}

Please arrange payment at your earliest convenience.

Thank you! 🤝`,
            }),
          });

          if (response.ok) {
            results.whatsappSent++;
          } else {
            const error = await response.json();
            results.errors.push(`WhatsApp failed for invoice ${invoice.invoiceNumber}: ${error.message || "Unknown error"}`);
          }
        } catch (whatsappError) {
          results.errors.push(`WhatsApp failed for invoice ${invoice.invoiceNumber}: ${whatsappError instanceof Error ? whatsappError.message : "Unknown error"}`);
        }
      }

      // Send Email Reminder
      if (invoice.customer.email) {
        try {
          await sendInvoiceReminderEmail({
            customerName: invoice.customer.name,
            customerEmail: invoice.customer.email,
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate ?? new Date(),
            total: invoice.total,
            balance: invoice.balance,
            isOverdue,
            daysOverdue,
            organizationName: invoice.organization?.name,
          });
          results.emailSent++;
        } catch (emailError) {
          results.errors.push(`Email failed for invoice ${invoice.invoiceNumber}: ${emailError instanceof Error ? emailError.message : "Unknown error"}`);
        }
      }

      // Update invoice reminder status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          reminderSent: true,
          reminderSentAt: now,
          status: isOverdue && invoice.status !== "overdue" ? "overdue" : invoice.status,
        },
      });

      results.processed++;
    }

    // Create a summary notification record
    if (results.processed > 0) {
      await prisma.notification.create({
        data: {
          type: "invoice_reminder_batch",
          recipientPhone: "system",
          message: `Processed ${results.processed} invoices: ${results.whatsappSent} WhatsApp, ${results.emailSent} emails sent.`,
          status: "sent",
          sentAt: now,
          metadata: {
            processed: results.processed,
            whatsappSent: results.whatsappSent,
            emailSent: results.emailSent,
            errors: results.errors.length,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Invoice reminders processed`,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Cron invoice reminders error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process invoice reminders",
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with different cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
