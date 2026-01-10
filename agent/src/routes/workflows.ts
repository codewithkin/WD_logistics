import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  notifyDriversAboutUpcomingTrips,
  sendInvoiceReminders,
  generateDailySummary,
  checkLicenseExpiries,
} from "../workflows";

const workflows = new Hono();

// Common request schema with organization ID
const orgSchema = z.object({
  organizationId: z.string().describe("The organization ID"),
});

/**
 * POST /workflows/trip-notifications
 * Trigger trip notification workflow
 */
workflows.post(
  "/trip-notifications",
  zValidator(
    "json",
    orgSchema.extend({
      daysAhead: z.number().optional().default(1).describe("Days ahead to check for trips"),
    })
  ),
  async (c) => {
    const { organizationId, daysAhead } = c.req.valid("json");
    const result = await notifyDriversAboutUpcomingTrips(organizationId, daysAhead);
    return c.json(result, result.success ? 200 : 500);
  }
);

/**
 * POST /workflows/invoice-reminders
 * Trigger invoice reminder workflow
 */
workflows.post(
  "/invoice-reminders",
  zValidator(
    "json",
    orgSchema.extend({
      minDaysOverdue: z.number().optional().default(1).describe("Minimum days overdue"),
    })
  ),
  async (c) => {
    const { organizationId, minDaysOverdue } = c.req.valid("json");
    const result = await sendInvoiceReminders(organizationId, minDaysOverdue);
    return c.json(result, result.success ? 200 : 500);
  }
);

/**
 * POST /workflows/daily-summary
 * Generate daily summary
 */
workflows.post("/daily-summary", zValidator("json", orgSchema), async (c) => {
  const { organizationId } = c.req.valid("json");
  const result = await generateDailySummary(organizationId);
  return c.json(result, result.success ? 200 : 500);
});

/**
 * POST /workflows/license-expiry-check
 * Check for expiring licenses
 */
workflows.post(
  "/license-expiry-check",
  zValidator(
    "json",
    orgSchema.extend({
      daysAhead: z.number().optional().default(30).describe("Days ahead to check"),
    })
  ),
  async (c) => {
    const { organizationId, daysAhead } = c.req.valid("json");
    const result = await checkLicenseExpiries(organizationId, daysAhead);
    return c.json(result, result.success ? 200 : 500);
  }
);

/**
 * POST /workflows/run-all
 * Run all daily workflows
 */
workflows.post("/run-all", zValidator("json", orgSchema), async (c) => {
  const { organizationId } = c.req.valid("json");

  const results = await Promise.all([
    notifyDriversAboutUpcomingTrips(organizationId),
    sendInvoiceReminders(organizationId),
    generateDailySummary(organizationId),
    checkLicenseExpiries(organizationId),
  ]);

  const [tripNotifications, invoiceReminders, dailySummary, licenseAlerts] = results;

  return c.json({
    success: results.every((r) => r.success),
    results: {
      tripNotifications,
      invoiceReminders,
      dailySummary,
      licenseAlerts,
    },
  });
});

/**
 * GET /workflows/health
 * Health check for workflows
 */
workflows.get("/health", (c) => {
  return c.json({
    status: "healthy",
    workflows: [
      "trip-notifications",
      "invoice-reminders",
      "daily-summary",
      "license-expiry-check",
      "run-all",
    ],
  });
});

export default workflows;
