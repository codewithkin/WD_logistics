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
import { stashDocument } from "@/lib/documents/handoff";
import { prisma } from "@/lib/prisma";
import { reportConfigs } from "@/config/reports";
import { getDateRangeFromParams } from "@/lib/period-utils";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

/** Report ids a person might reasonably ask for by name over a message. */
const REPORT_IDS = Object.keys(reportConfigs) as [string, ...string[]];

/**
 * Above this a document is handed over as a link instead of a file.
 *
 * Not WhatsApp's own limit (roughly 100MB) — the limit of the thing doing the
 * sending. whatsapp-web.js serialises the file through the Chromium page it
 * drives, which is slow at a megabyte and unreliable well below WhatsApp's
 * ceiling. 8MB keeps the common case a real attachment and the rare case a
 * link that works.
 */
const ATTACHMENT_LIMIT_BYTES = 8 * 1024 * 1024;

/**
 * What a report about one record needs naming, in words a person would use.
 *
 * All 23 reports can be produced here. Two of them could not until now — the
 * trailer and trip expense reports — on the reasoning that those records are
 * identified by ids nobody carries in their head. A trailer has a
 * registration painted on it, and a trip has a route and a date, so both are
 * findable from what somebody would actually type. Every resolver below
 * refuses rather than guesses when a phrase matches more than one record.
 */
function needsNaming(id: string): string | null {
  const config = reportConfigs[id];
  if (config?.requiresCustomer) return "a customer name";
  if (config?.requiresTruck) return "a truck registration";
  if (config?.requiresTrailer) return "a trailer registration";
  if (config?.requiresTrip) return "a trip — its route, and the date if there is more than one";
  return null;
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

/**
 * Resolving the customer or truck a report is about, from what somebody
 * typed. Both refuse rather than guess when the phrase matches more than
 * one, which is the same rule every other operation follows: picking for
 * them is how the wrong customer gets a statement.
 */
async function findCustomerFor(
  ctx: OperationContext,
  phrase: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const rows = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { name: { contains: phrase, mode: "insensitive" } },
        { contactPerson: { contains: phrase, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
    take: 6,
  });

  if (rows.length === 0) return { ok: false, error: `No customer matches "${phrase}".` };
  if (rows.length > 1) {
    return {
      ok: false,
      error: `That matches several customers: ${rows.map((r) => r.name).join(", ")}. Which one?`,
    };
  }
  return { ok: true, id: rows[0].id, name: rows[0].name };
}

async function findTruckFor(
  ctx: OperationContext,
  phrase: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const rows = await prisma.truck.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { registrationNo: { contains: phrase, mode: "insensitive" } },
        { make: { contains: phrase, mode: "insensitive" } },
        { model: { contains: phrase, mode: "insensitive" } },
      ],
    },
    select: { id: true, registrationNo: true },
    take: 6,
  });

  if (rows.length === 0) return { ok: false, error: `No truck matches "${phrase}".` };
  if (rows.length > 1) {
    return {
      ok: false,
      error: `That matches several trucks: ${rows.map((r) => r.registrationNo).join(", ")}. Which one?`,
    };
  }
  return { ok: true, id: rows[0].id, name: rows[0].registrationNo };
}

async function findTrailerFor(
  ctx: OperationContext,
  phrase: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const rows = await prisma.trailer.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { registrationNo: { contains: phrase, mode: "insensitive" } },
        { make: { contains: phrase, mode: "insensitive" } },
        { model: { contains: phrase, mode: "insensitive" } },
      ],
    },
    select: { id: true, registrationNo: true },
    take: 6,
  });

  if (rows.length === 0) return { ok: false, error: `No trailer matches "${phrase}".` };
  if (rows.length > 1) {
    return {
      ok: false,
      error: `That matches several trailers: ${rows.map((r) => r.registrationNo).join(", ")}. Which one?`,
    };
  }
  return { ok: true, id: rows[0].id, name: rows[0].registrationNo };
}

/**
 * A trip, from a route and optionally a date.
 *
 * There is no trip number in the schema, so "Mutare to Beira" is what a
 * person has. That usually matches several, which is why the date narrows it
 * and why the refusal lists the candidates with their dates rather than
 * picking the most recent — the most recent is not necessarily the one they
 * mean, and a report about the wrong trip is worse than a question.
 */
async function findTripFor(
  ctx: OperationContext,
  phrase: string,
  on?: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const words = phrase
    .split(/\s+|→|->|\bto\b/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  const day = on ? new Date(on) : null;
  const onDay =
    day && !Number.isNaN(day.getTime())
      ? {
          scheduledDate: {
            gte: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
            lt: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
          },
        }
      : {};

  const rows = await prisma.trip.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...onDay,
      ...(words.length > 0
        ? {
            AND: words.map((word) => ({
              OR: [
                { originCity: { contains: word, mode: "insensitive" as const } },
                { destinationCity: { contains: word, mode: "insensitive" as const } },
                { loadDescription: { contains: word, mode: "insensitive" as const } },
              ],
            })),
          }
        : {}),
    },
    select: {
      id: true,
      originCity: true,
      destinationCity: true,
      scheduledDate: true,
    },
    orderBy: { scheduledDate: "desc" },
    take: 8,
  });

  const label = (row: (typeof rows)[number]) =>
    `${row.originCity} to ${row.destinationCity} on ${row.scheduledDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  if (rows.length === 0) {
    return {
      ok: false,
      error: `No trip matches "${phrase}"${on ? ` on ${on}` : ""}.`,
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      error: `That matches several trips: ${rows.slice(0, 5).map(label).join("; ")}. Which one?`,
    };
  }
  return { ok: true, id: rows[0].id, name: label(rows[0]) };
}

export const reportOperations: Operation[] = [
  {
    name: "list_reports",
    description:
      "The reports that can be produced and sent in this chat, with what each one covers.",
    requires: "admin",
    schema: z.object({}),
    handler: async () => {
      // Every report the web app offers, with nothing withheld: the same 23
      // ids, the same names, produced by the same code.
      return Object.values(reportConfigs).map((config) => {
        const needs = needsNaming(config.id);
        return {
          id: config.id,
          name: config.name,
          covers: config.description,
          // So the model asks for the name up front rather than calling the
          // tool, being told which record, and calling it again.
          ...(needs ? { needs } : {}),
        };
      });
    },
  },

  {
    name: "generate_report",
    description:
      "Produce a report and send the file back in this chat. Use list_reports first if you are unsure of the id. PDF is right for reading on a phone; CSV for a spreadsheet. Reports about one customer or one truck take that name here — a statement, for instance, needs the customer.",
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
      customer: z
        .string()
        .optional()
        .describe("Customer name, for a report about one customer such as a statement"),
      truck: z
        .string()
        .optional()
        .describe("Truck registration, for a report about one truck"),
      trailer: z
        .string()
        .optional()
        .describe("Trailer registration, for a report about one trailer"),
      trip: z
        .string()
        .optional()
        .describe(
          "The trip, for a report about one trip — its route, e.g. \"Mutare to Beira\"",
        ),
      tripDate: z
        .string()
        .optional()
        .describe("ISO date of that trip, when the route alone matches more than one"),
    }),
    handler: async (args, ctx: OperationContext) => {
      const a = args as {
        report: string;
        period?: string;
        from?: string;
        to?: string;
        format?: "pdf" | "csv";
        customer?: string;
        truck?: string;
        trailer?: string;
        trip?: string;
        tripDate?: string;
      };

      const config = reportConfigs[a.report];
      if (!config) return { error: `There is no report called "${a.report}".` };

      // Reports about one record used to be refused outright and the caller
      // sent to the web app — which meant a customer statement, the document
      // most often wanted in a hurry, could not be produced from a phone.
      // Name the customer or the truck and it resolves the same way every
      // other operation does.
      let customerId: string | undefined;
      let truckId: string | undefined;
      let trailerId: string | undefined;
      let tripId: string | undefined;

      if (config.requiresCustomer) {
        if (!a.customer) {
          return { error: `"${config.name}" is about one customer. Which customer?` };
        }
        const found = await findCustomerFor(ctx, a.customer);
        if (!found.ok) return { error: found.error };
        customerId = found.id;
      }

      if (config.requiresTruck) {
        if (!a.truck) {
          return { error: `"${config.name}" is about one truck. Which truck?` };
        }
        const found = await findTruckFor(ctx, a.truck);
        if (!found.ok) return { error: found.error };
        truckId = found.id;
      }

      if (config.requiresTrailer) {
        if (!a.trailer) {
          return { error: `"${config.name}" is about one trailer. Which trailer?` };
        }
        const found = await findTrailerFor(ctx, a.trailer);
        if (!found.ok) return { error: found.error };
        trailerId = found.id;
      }

      if (config.requiresTrip) {
        if (!a.trip) {
          return {
            error: `"${config.name}" is about one trip. Which trip — the route, and the date if there is more than one?`,
          };
        }
        const found = await findTripFor(ctx, a.trip, a.tripDate);
        if (!found.ok) return { error: found.error };
        tripId = found.id;
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
        customerId,
        truckId,
        trailerId,
        tripId,
        // A person reading on a phone wants the title block; a spreadsheet
        // import does not, but that is the rarer case from a chat.
        includeMetadata: true,
      });

      if (!result.success || !result.data) {
        return { error: result.error ?? "The report could not be produced." };
      }

      const bytes = Buffer.from(result.data, "base64").length;

      // Past this, do not even try to put it in the chat. whatsapp-web.js
      // sends a document by pushing the whole thing through the browser it
      // drives, and that is where "it generated the report but never sent it"
      // came from. The file exists either way, so park it and send a link:
      // the person gets the report, which is the point.
      if (bytes > ATTACHMENT_LIMIT_BYTES) {
        const stashed = await stashDocument({
          organizationId: ctx.organizationId,
          filename: friendlyFilename(config.name, range.from, range.to, format),
          // The generator always sets one; the type allows undefined.
          mimeType: result.mimeType ?? "application/octet-stream",
          base64: result.data,
          forPhone: ctx.actorPhone ?? null,
          createdById: ctx.actorUserId ?? null,
        });
        return {
          report: config.name,
          period: range.label,
          format,
          sizeKb: stashed.sizeKb,
          sending: false,
          // The model is told to pass this on, in its own words.
          downloadUrl: stashed.url,
          expiresAt: stashed.expiresAt.toISOString(),
          note: `Too big to send in the chat (${(bytes / 1024 / 1024).toFixed(1)}MB). Give them the link — it works for 24 hours.`,
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
