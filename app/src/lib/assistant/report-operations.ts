import "server-only";

/**
 * Producing a report and sending the file back in the chat.
 *
 * The important design point is what the *model* sees. A generated PDF is
 * most of a megabyte; as base64 in a tool result it would be well over a
 * million characters of context, cost more than the report is worth, and
 * probably not fit at all.
 *
 * So the file never reaches the model. The operation returns a short summary
 * plus an `attachment` envelope, and the agent lifts that envelope out of the
 * result before handing the rest to the model (see `agent/src/tools/app-tools.ts`).
 * The model writes a sentence about a report it has never seen the bytes of,
 * and the WhatsApp layer sends the document alongside.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reportConfigs } from "@/config/reports";
import { getDateRangeFromParams } from "@/lib/period-utils";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

/** Report ids a person might reasonably ask for by name over a message. */
const REPORT_IDS = Object.keys(reportConfigs) as [string, ...string[]];

/**
 * Anything needing a specific record picked first is excluded: a message
 * cannot carry a truck id, and asking for one defeats the point.
 */
function needsSelection(id: string): boolean {
  const config = reportConfigs[id];
  return Boolean(
    config?.requiresCustomer ||
      config?.requiresTruck ||
      config?.requiresTrailer ||
      config?.requiresTrip,
  );
}

/** "profit-and-loss-2026-06-23-to-2026-09-24.pdf" */
function friendlyFilename(
  reportName: string,
  from: Date,
  to: Date,
  format: string,
): string {
  const slug = reportName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const day = (d: Date) => d.toISOString().split("T")[0];
  return `${slug}-${day(from)}-to-${day(to)}.${format}`;
}

export const reportOperations: Operation[] = [
  {
    name: "list_reports",
    description:
      "The reports that can be produced and sent in this chat, with what each one covers.",
    requires: "admin",
    schema: z.object({}),
    handler: async () => {
      return Object.values(reportConfigs)
        .filter((config) => !needsSelection(config.id))
        .map((config) => ({
          id: config.id,
          name: config.name,
          covers: config.description,
        }));
    },
  },

  {
    name: "generate_report",
    description:
      "Produce a report and send the file back in this chat. Use list_reports first if you are unsure of the id. PDF is right for reading on a phone; CSV for a spreadsheet.",
    requires: "admin",
    writes: false,
    schema: z.object({
      report: z.enum(REPORT_IDS).describe("The report id, from list_reports"),
      period: z
        .string()
        .optional()
        .describe('"7d", "1m", "3m", "6m", "1y", "ytd", "all". Defaults to 1m.'),
      from: z.string().optional().describe("ISO start date, for an exact range"),
      to: z.string().optional().describe("ISO end date"),
      format: z.enum(["pdf", "csv"]).optional().describe("Defaults to pdf"),
    }),
    handler: async (args, ctx: OperationContext) => {
      const a = args as {
        report: string;
        period?: string;
        from?: string;
        to?: string;
        format?: "pdf" | "csv";
      };

      const config = reportConfigs[a.report];
      if (!config) return { error: `There is no report called "${a.report}".` };
      if (needsSelection(a.report)) {
        return {
          error: `"${config.name}" has to be run against one specific record, which is easier in the web app under Reports.`,
        };
      }

      const range = getDateRangeFromParams(
        { period: a.period, from: a.from, to: a.to },
        "1m",
      );
      const format = a.format ?? "pdf";

      const { generateReport } = await import("@/app/(dashboard)/reports/actions");
      const result = await generateReport({
        reportType: a.report as never,
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
        period: a.period ?? "1m",
        format,
        // A person reading on a phone wants the title block; a spreadsheet
        // import does not, but that is the rarer case from a chat.
        includeMetadata: true,
      });

      if (!result.success || !result.data) {
        return { error: result.error ?? "The report could not be produced." };
      }

      const bytes = Buffer.from(result.data, "base64").length;

      // WhatsApp refuses documents over roughly 100MB, and anything close to
      // that is useless on a phone anyway. Saying so beats a silent failure.
      if (bytes > 40 * 1024 * 1024) {
        return {
          error: `That report came to ${(bytes / 1024 / 1024).toFixed(0)}MB, which is too large to send over WhatsApp. Narrow the period, or download it from Reports in the web app.`,
        };
      }

      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      return {
        // What the model gets to talk about.
        report: config.name,
        period: range.label,
        format,
        sizeKb: Math.round(bytes / 1024),
        sending: true,
        company: organization?.name ?? "WD Logistics",

        // Lifted out by the agent before the model ever sees it. Keep the
        // shape stable — app-tools.ts looks for exactly this key.
        attachment: {
          // The action names files from raw ISO strings, which on a phone
          // reads as "profit-loss-2026-06-23T22:00:00.000Z-to-...". Renamed
          // to something a person can recognise in their downloads.
          filename: friendlyFilename(config.name, range.from, range.to, format),
          mimeType: result.mimeType,
          base64: result.data,
        },
      };
    },
  },
];
