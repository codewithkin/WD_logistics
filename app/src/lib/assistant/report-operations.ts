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

  {
    name: "create_pdf",
    description:
      "Turn figures you already have into a PDF and send it in this chat. For when someone wants a document of something you just worked out, or a report list_reports does not cover. It renders what you give it — it looks nothing up.",
    requires: "admin",
    writes: false,
    schema: z.object({
      title: z.string().describe("Heading, e.g. 'Fleet ranking by profit'"),
      subtitle: z.string().optional(),
      summary: z
        .array(
          z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()]),
            format: z.enum(["currency", "percentage", "number", "text"]).optional(),
          }),
        )
        .optional()
        .describe("Up to 6 headline figures, shown as tiles under the title"),
      sections: z
        .array(
          z.object({
            title: z.string(),
            columns: z
              .array(
                z.object({
                  header: z.string().describe("Column heading"),
                  key: z.string().describe("Matching key in every row"),
                  format: z
                    .enum(["currency", "percentage", "number", "date", "text"])
                    .optional(),
                  align: z.enum(["left", "center", "right"]).optional(),
                }),
              )
              .min(1),
            rows: z
              .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
              .describe("One object per row, keyed by the column keys"),
            totalColumns: z
              .array(z.string())
              .optional()
              .describe("Column keys to total in a bottom row"),
          }),
        )
        .min(1)
        .describe("One table per section"),
      notes: z.array(z.string()).optional().describe("Footnotes, e.g. what the figures exclude"),
      from: z.string().optional().describe("ISO start of the period covered"),
      to: z.string().optional().describe("ISO end of the period covered"),
    }),
    handler: async (args, ctx: OperationContext) => {
      const a = args as {
        title: string;
        subtitle?: string;
        summary?: Array<{ label: string; value: string | number; format?: string }>;
        sections: Array<{
          title: string;
          columns: Array<{ header: string; key: string; format?: string; align?: string }>;
          rows: Array<Record<string, string | number | null>>;
          totalColumns?: string[];
        }>;
        notes?: string[];
        from?: string;
        to?: string;
      };

      // An empty table renders as a title over nothing, which looks broken
      // rather than empty. Say so instead, so the model writes a sentence.
      const populated = a.sections.filter((section) => section.rows.length > 0);
      if (populated.length === 0) {
        return {
          error:
            "There are no rows to put in the document. Say the figures in the chat instead of sending an empty PDF.",
        };
      }

      // Guardrails against a model that has miscounted: a PDF nobody can
      // read is worse than a refusal.
      const totalRows = populated.reduce((sum, section) => sum + section.rows.length, 0);
      if (totalRows > 2000) {
        return {
          error: `That would be ${totalRows} rows, which is too long to read on a phone. Narrow it down, or run the full report from the web app.`,
        };
      }

      const to = a.to ? new Date(a.to) : new Date();
      const from = a.from
        ? new Date(a.from)
        : new Date(new Date(to).setMonth(to.getMonth() - 1));
      const validRange = !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime());

      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
      });

      const { PDFReportGenerator } = await import("@/lib/reports/pdf-report-generator");

      const generator = new PDFReportGenerator(
        {
          title: a.title,
          subtitle: a.subtitle,
          reportType: "assistant-document",
          period: {
            startDate: validRange ? from : new Date(),
            endDate: validRange ? to : new Date(),
          },
          summary: a.summary?.slice(0, 6).map((item) => ({
            label: item.label,
            value: item.value,
            format: item.format as "currency" | "percentage" | "number" | "text" | undefined,
          })),
          sections: populated.map((section) => ({
            title: section.title,
            columns: section.columns.map((column) => ({
              header: column.header,
              key: column.key,
              format: column.format as
                | "currency"
                | "percentage"
                | "number"
                | "date"
                | "text"
                | undefined,
              align: column.align as "left" | "center" | "right" | undefined,
            })),
            // A key the model leaves off a row needs no filling in: the
            // generator's formatCell already prints an em dash for null,
            // undefined and empty alike. Verified against a rendered file.
            data: section.rows.map((row) => ({ ...row })),
            showTotal: Boolean(section.totalColumns?.length),
            totalLabel: "Total",
            totalColumns: section.totalColumns,
          })),
          notes: a.notes,
          companyName: organization?.name ?? "WD Logistics",
        },
        organization,
      );

      const bytes = Buffer.from(generator.generate());

      return {
        document: a.title,
        rows: totalRows,
        sizeKb: Math.round(bytes.length / 1024),
        sending: true,

        // Lifted out by the agent before the model sees it — same envelope
        // generate_report uses; app-tools.ts looks for exactly this key.
        attachment: {
          filename: friendlyFilename(a.title, from, to, "pdf"),
          mimeType: "application/pdf",
          base64: bytes.toString("base64"),
        },
      };
    },
  },
];
