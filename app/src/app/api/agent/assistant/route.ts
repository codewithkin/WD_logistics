/**
 * The assistant's single door into the app.
 *
 * The agent has no database access, so everything it does comes through here.
 * Three actions:
 *
 *   identify  — who is this phone number, and what may they do?
 *   manifest  — the tool definitions this contact is allowed to use
 *   invoke    — run one operation as that contact
 *
 * Authorisation happens twice, deliberately. The shared secret proves the
 * caller is the agent; the contact lookup proves the *person* is allowed, and
 * every operation re-checks the role it needs. A phone number is not a
 * session, and the agent is not a trusted narrator of who is asking.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAgentAuth } from "@/lib/agent-auth";
import {
  findOperation,
  operationManifest,
  roleAllows,
  weakerRole,
  type OperationContext,
} from "@/lib/assistant/operations";
import { toE164 } from "@/lib/whatsapp/trip-messages";
import { z } from "zod";
import { runAsActor } from "@/lib/acting-session";
import type { Role } from "@/lib/types";

/**
 * The dashboard account a contact acts as, where an admin has linked one.
 *
 * Writes run as this user: the real server actions need a session, and the
 * audit trail should name a person rather than "the assistant". The role comes
 * from their `Member` row, never from the contact list.
 */
async function resolveActor(contact: {
  organizationId: string;
  userId: string | null;
}) {
  if (!contact.userId) return null;

  const member = await prisma.member.findFirst({
    where: { userId: contact.userId, organizationId: contact.organizationId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!member?.user) return null;

  return {
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image ?? null,
    },
    role: member.role as Role,
    organizationId: contact.organizationId,
  };
}

/** Resolves a phone number to an allowed contact, or null. */
async function resolveContact(rawPhone: string) {
  const phone = toE164(rawPhone);
  if (!phone) return null;

  return prisma.whatsAppContact.findFirst({
    where: { phone, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      organizationId: true,
      userId: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = withAgentAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const action: string | undefined = body?.action;
  const phone: string | undefined = body?.phone;

  if (!phone) {
    return NextResponse.json(
      { success: false, error: "phone is required" },
      { status: 400 },
    );
  }

  const contact = await resolveContact(phone);

  // An unknown number gets a flat no, with no hint about what exists. The
  // assistant turns this into "I don't have you on the list — ask an admin to
  // add you under Settings."
  if (!contact) {
    return NextResponse.json({
      success: true,
      data: { authorized: false },
    });
  }

  const actor = await resolveActor(contact);

  // Reads are answered at the contact's own level. Anything that writes runs
  // through the app's real server actions as the linked account, so the
  // effective role is whichever of the two grants less.
  const effectiveRole = actor
    ? weakerRole(contact.role, actor.role)
    : contact.role;

  const ctx: OperationContext = {
    organizationId: contact.organizationId,
    role: effectiveRole,
    actorName: contact.name,
    actorUserId: contact.userId,
  };

  switch (action) {
    case "identify": {
      const organization = await prisma.organization.findUnique({
        where: { id: contact.organizationId },
        select: { name: true },
      });
      return NextResponse.json({
        success: true,
        data: {
          authorized: true,
          name: contact.name,
          role: effectiveRole,
          organizationName: organization?.name ?? "WD Logistics",
        },
      });
    }

    case "manifest": {
      return NextResponse.json({
        success: true,
        data: {
          authorized: true,
          name: contact.name,
          role: effectiveRole,
          // An operation that writes is only offered when there is an account
          // to write as — otherwise the model would keep trying a tool that
          // can never succeed.
          tools: operationManifest(effectiveRole).filter(
            (tool) => !tool.writes || Boolean(actor),
          ),
        },
      });
    }

    case "invoke": {
      const name: string | undefined = body?.operation;
      const args = (body?.args ?? {}) as Record<string, unknown>;

      if (!name) {
        return NextResponse.json(
          { success: false, error: "operation is required" },
          { status: 400 },
        );
      }

      const operation = findOperation(name);
      if (!operation) {
        return NextResponse.json(
          { success: false, error: `Unknown operation: ${name}` },
          { status: 400 },
        );
      }

      // The check that matters. The manifest already hides operations this
      // contact cannot run, but the agent could ask for one anyway — either
      // through a bug or because a model hallucinated a tool name.
      if (!roleAllows(effectiveRole, operation.requires)) {
        return NextResponse.json({
          success: false,
          error: `${contact.name} is ${effectiveRole}; "${name}" needs ${operation.requires}.`,
        });
      }

      // Writes go through the same server actions the web forms call, and
      // those begin with `requireAuth()`. Without a linked account there is
      // nobody to record the change against, and saying so is better than
      // recording it against no one.
      if (operation.writes && !actor) {
        return NextResponse.json({
          success: false,
          error: `${contact.name}'s number isn't linked to a dashboard account, so nothing can be recorded under their name. An admin can link it under Settings → WhatsApp assistant.`,
        });
      }

      // Rejected rather than stripped. Zod drops unknown keys by default,
      // which for a write operation is the worst possible behaviour: a model
      // that sends {direction: "out", quantity: 3} to adjust_stock would have
      // the direction silently discarded and three parts *added* to the
      // warehouse. An unrecognised argument means the model misunderstood the
      // tool, and it should be told so.
      const schema =
        operation.schema instanceof z.ZodObject
          ? operation.schema.strict()
          : operation.schema;

      const parsed = schema.safeParse(args);
      if (!parsed.success) {
        return NextResponse.json({
          success: false,
          error: `Those arguments aren't right: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
            .join("; ")}`,
        });
      }

      try {
        const run = () =>
          operation.handler(parsed.data as Record<string, unknown>, ctx);

        // Reads query Prisma directly and need no session; writes need one,
        // and get the linked account's for the length of this call only.
        const data = actor ? await runAsActor(actor, run) : await run();

        // A write operation that bailed out — an ambiguous truck, a category
        // that matched nothing — returns `{ error }` rather than throwing, so
        // the assistant can ask a follow-up question. Nothing was recorded,
        // and the transcript must not claim otherwise.
        const refused =
          typeof data === "object" &&
          data !== null &&
          "error" in (data as Record<string, unknown>);

        return NextResponse.json({
          success: true,
          data,
          writes: Boolean(operation.writes) && !refused,
        });
      } catch (error) {
        console.error(`[assistant] ${name} failed:`, error);
        return NextResponse.json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "That didn't work; nothing was changed.",
        });
      }
    }

    case "log": {
      // The transcript, written by the agent after each exchange. It is the
      // audit trail for anything the assistant changed.
      const direction: string = body?.direction === "outbound" ? "outbound" : "inbound";
      const text: string = String(body?.body ?? "");
      const toolCalls = body?.toolCalls ?? null;
      const didWrite = Boolean(body?.didWrite);

      await prisma.$transaction([
        prisma.whatsAppMessage.create({
          data: {
            organizationId: contact.organizationId,
            contactId: contact.id,
            direction,
            phone: toE164(phone) ?? phone,
            body: text.slice(0, 4000),
            toolCalls: toolCalls ?? undefined,
            didWrite,
            error: body?.error ? String(body.error).slice(0, 500) : null,
          },
        }),
        prisma.whatsAppContact.update({
          where: { id: contact.id },
          data: {
            lastSeenAt: new Date(),
            ...(direction === "inbound" ? { messageCount: { increment: 1 } } : {}),
          },
        }),
      ]);

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}
