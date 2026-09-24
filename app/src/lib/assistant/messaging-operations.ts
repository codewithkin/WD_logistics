import "server-only";

/**
 * Sending a WhatsApp message to somebody else, on request.
 *
 * "Tell Daniel the truck is ready" is a reasonable thing to ask a fleet
 * assistant, and it is also the most abusable capability in it — a bot that
 * will message any number on instruction is a spam engine, and the
 * instruction could come from text the model read rather than from the
 * person. So:
 *
 *  - supervisor and above only;
 *  - the recipient must be somebody already on file (driver, employee,
 *    customer, supplier or an approved assistant contact) unless an **admin**
 *    gives an explicit number, which is the one case where a name cannot help;
 *  - every message is written to `Notification` before it is sent, naming who
 *    asked for it, so there is a record independent of the chat;
 *  - the text is passed through verbatim and never invented — the model is
 *    told to quote the sender's own words.
 *
 * Like a generated report, the message itself leaves through the agent: the
 * operation returns an `outboundMessage` envelope, which the agent lifts and
 * puts on the wire with its paired WhatsApp client.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toE164 } from "@/lib/whatsapp/trip-messages";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

interface Recipient {
  name: string;
  phone: string;
  kind: string;
}

/** Everyone the assistant is allowed to message, gathered by name. */
async function findRecipients(
  ctx: OperationContext,
  phrase: string,
): Promise<Recipient[]> {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const match = (fields: string[]) => ({
    AND: words.map((word) => ({
      OR: fields.map((field) => ({
        [field]: { contains: word, mode: "insensitive" as const },
      })),
    })),
  });

  const [drivers, employees, customers, suppliers, contacts] = await Promise.all([
    prisma.driver.findMany({
      where: { organizationId: ctx.organizationId, ...match(["firstName", "lastName"]) },
      select: { firstName: true, lastName: true, phone: true, whatsappNumber: true },
      take: 5,
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organizationId, ...match(["firstName", "lastName", "position"]) },
      select: { firstName: true, lastName: true, phone: true },
      take: 5,
    }),
    prisma.customer.findMany({
      where: { organizationId: ctx.organizationId, ...match(["name", "contactPerson"]) },
      select: { name: true, phone: true },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: { organizationId: ctx.organizationId, ...match(["name", "contactPerson"]) },
      select: { name: true, phone: true },
      take: 5,
    }),
    prisma.whatsAppContact.findMany({
      where: { organizationId: ctx.organizationId, isActive: true, ...match(["name"]) },
      select: { name: true, phone: true },
      take: 5,
    }),
  ]);

  const out: Recipient[] = [];
  const seen = new Set<string>();

  const add = (name: string, phone: string | null, kind: string) => {
    const e164 = phone ? toE164(phone) : null;
    if (!e164 || seen.has(e164)) return;
    seen.add(e164);
    out.push({ name, phone: e164, kind });
  };

  for (const d of drivers) {
    add(`${d.firstName} ${d.lastName}`, d.whatsappNumber ?? d.phone, "driver");
  }
  for (const e of employees) add(`${e.firstName} ${e.lastName}`, e.phone, "employee");
  for (const c of customers) add(c.name, c.phone, "customer");
  for (const s of suppliers) add(s.name, s.phone, "supplier");
  for (const c of contacts) add(c.name, c.phone, "contact");

  return out;
}

export const messagingOperations: Operation[] = [
  {
    name: "send_whatsapp_message",
    description:
      "Send a WhatsApp message to someone on file — a driver, employee, customer, supplier or listed contact. Quote what the sender actually wants said; do not compose something they did not ask for. Say who it went to once it is sent.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      to: z
        .string()
        .describe(
          "Who to message, by name. An admin may give a phone number instead when the person is not on file.",
        ),
      message: z.string().describe("Exactly what to say to them"),
    }),
    handler: async (args, ctx) => {
      const a = args as { to: string; message: string };

      const text = a.message.trim();
      if (text.length === 0) return { error: "There's no message to send." };
      if (text.length > 3000) {
        return { error: "That message is too long for WhatsApp; shorten it." };
      }

      // A bare number is only accepted from an admin. For everyone else a
      // name is required, which keeps the assistant inside the address book.
      const looksLikeNumber = /^[+\d][\d\s()-]{6,}$/.test(a.to.trim());
      let recipient: Recipient;

      if (looksLikeNumber) {
        if (ctx.role !== "admin") {
          return {
            error:
              "Only an admin can message a raw phone number. Give the person's name if they are on file.",
          };
        }
        const e164 = toE164(a.to);
        if (!e164) return { error: "That doesn't look like a phone number." };
        recipient = { name: e164, phone: e164, kind: "number" };
      } else {
        const matches = await findRecipients(ctx, a.to);
        if (matches.length === 0) {
          return {
            error: `Nobody on file matches "${a.to}" with a phone number against them.`,
          };
        }
        if (matches.length > 1) {
          const shown = matches
            .slice(0, 5)
            .map((m) => `${m.name} (${m.kind})`)
            .join(", ");
          return { error: `That matches several people: ${shown}. Which one?` };
        }
        recipient = matches[0];
      }

      // Recorded before it is sent, and attributed to the person who asked.
      // If the send then fails, there is still a record that it was tried.
      const notification = await prisma.notification.create({
        data: {
          organizationId: ctx.organizationId,
          type: "assistant_message",
          recipientPhone: recipient.phone,
          recipientName: recipient.name,
          message: text,
          status: "pending",
          metadata: {
            sentBy: ctx.actorName,
            sentByPhone: "assistant",
            recipientKind: recipient.kind,
          },
        },
        select: { id: true },
      });

      return {
        queued: true,
        to: recipient.name,
        kind: recipient.kind,
        // The agent lifts this out and puts it on the wire; it never goes to
        // the model. Keep the shape stable — app-tools.ts matches this key.
        outboundMessage: {
          notificationId: notification.id,
          phone: recipient.phone,
          text,
        },
      };
    },
  },

  {
    name: "list_sent_messages",
    description:
      "Messages the assistant has sent on someone's behalf, and whether they arrived.",
    requires: "supervisor",
    schema: z.object({
      limit: z.number().optional().describe("Defaults to 10"),
    }),
    handler: async (args, ctx) => {
      const a = args as { limit?: number };
      const rows = await prisma.notification.findMany({
        where: { organizationId: ctx.organizationId, type: "assistant_message" },
        select: {
          recipientName: true,
          recipientPhone: true,
          message: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(a.limit ?? 10, 30),
      });

      return rows.map((r) => ({
        to: r.recipientName ?? r.recipientPhone,
        message: r.message.length > 80 ? `${r.message.slice(0, 77)}...` : r.message,
        status: r.status,
        sentBy: (r.metadata as { sentBy?: string } | null)?.sentBy ?? "unknown",
        when: r.createdAt.toISOString().replace("T", " ").slice(0, 16),
      }));
    },
  },
];
