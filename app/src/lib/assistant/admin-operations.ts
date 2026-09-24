import "server-only";

/**
 * People and access, over the assistant.
 *
 * Everything here runs the same server action the Users page calls, under the
 * acting session, so an admin adding someone by message and an admin adding
 * someone by browser take identical code paths.
 *
 * ⚠️ Passwords travel through a WhatsApp conversation to get here, and the
 * transcript is stored. `lib/assistant/redact.ts` strips them before anything
 * is written, but the message still passed through WhatsApp's servers and
 * sits in the sender's own chat history, which nothing here can reach. That
 * is a real weakness of doing this by message rather than in the web app, and
 * `set_user_password` says so in its description so the model can warn people.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

const ROLES = ["admin", "supervisor", "staff", "workshop"] as const;

/** Finds one member by name or email, or explains why it can't. */
async function findMember(ctx: OperationContext, phrase: string) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { ok: false as const, error: "Who do you mean?" };

  const rows = await prisma.member.findMany({
    where: {
      organizationId: ctx.organizationId,
      AND: words.map((word) => ({
        user: {
          OR: [
            { name: { contains: word, mode: "insensitive" as const } },
            { email: { contains: word, mode: "insensitive" as const } },
          ],
        },
      })),
    },
    select: {
      id: true,
      role: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
    take: 6,
  });

  if (rows.length === 0) {
    return { ok: false as const, error: `Nobody on the team matches "${phrase}".` };
  }
  if (rows.length > 1) {
    const shown = rows.slice(0, 5).map((r) => `${r.user.name} (${r.user.email})`);
    return {
      ok: false as const,
      error: `That matches ${shown.length}: ${shown.join(", ")}. Which one?`,
    };
  }
  return { ok: true as const, row: rows[0] };
}

export const adminOperations: Operation[] = [
  {
    name: "list_users",
    description:
      "Everyone with access to the system, and what level each of them has.",
    requires: "admin",
    schema: z.object({
      search: z.string().optional().describe("Match on name or email"),
    }),
    handler: async (args, ctx) => {
      const a = args as { search?: string };
      const members = await prisma.member.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(a.search
            ? {
                user: {
                  OR: [
                    { name: { contains: a.search, mode: "insensitive" } },
                    { email: { contains: a.search, mode: "insensitive" } },
                  ],
                },
              }
            : {}),
        },
        select: {
          role: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return members.map((m) => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        since: m.createdAt.toISOString().split("T")[0],
      }));
    },
  },

  {
    name: "create_user",
    description:
      "Add a new person to the system. Creates their account, emails them their password and a sign-in link, and hands the link back so it can be passed on directly.",
    requires: "admin",
    writes: true,
    schema: z.object({
      name: z.string().describe("Their full name"),
      email: z.string().describe("Their email address"),
      role: z
        .enum(ROLES)
        .describe(
          "admin (everything), supervisor (operations), staff (view and create), workshop (maintenance jobs)",
        ),
    }),
    handler: async (args) => {
      const a = args as { name: string; email: string; role: (typeof ROLES)[number] };

      const { createUserWithRole } = await import(
        "@/app/(dashboard)/users/actions"
      );
      const result = await createUserWithRole(a);

      if (!result.success) return { error: result.error };

      return {
        created: !result.added,
        addedToTeam: result.added,
        name: result.name,
        email: result.email,
        role: result.role,
        signInLink: result.signInUrl,
        // Returned so the admin can forward it when email is not working;
        // the transcript redacts it before storage.
        temporaryPassword: "password" in result ? result.password : null,
        emailed: "emailed" in result ? result.emailed : true,
        message: result.message,
      };
    },
  },

  {
    name: "reset_user_password",
    description:
      "Generate a new random password for someone and email it to them. Use this when they are not with you — the password goes to their inbox, not through this chat.",
    requires: "admin",
    writes: true,
    schema: z.object({
      person: z.string().describe("Their name or email"),
    }),
    handler: async (args, ctx) => {
      const a = args as { person: string };
      const found = await findMember(ctx, a.person);
      if (!found.ok) return { error: found.error };

      const { resetUserPassword } = await import(
        "@/app/(dashboard)/users/actions"
      );
      const result = await resetUserPassword(found.row.id);

      if (!result.success) return { error: result.error };
      return {
        reset: true,
        person: found.row.user.name,
        email: found.row.user.email,
        emailed: !String(result.message ?? "").includes("failed"),
        message: result.message,
        // Only useful when the email failed; redacted from the transcript.
        newPassword: result.newPassword ?? null,
      };
    },
  },

  {
    name: "set_user_password",
    description:
      "Set someone's password to a specific value — including your own. Prefer reset_user_password: a password typed into a chat also lives in that chat's history on the phone, which nothing here can erase.",
    requires: "admin",
    writes: true,
    schema: z.object({
      person: z.string().describe("Their name or email, or 'me' for yourself"),
      newPassword: z.string().describe("At least 8 characters"),
    }),
    handler: async (args, ctx) => {
      const a = args as { person: string; newPassword: string };

      let memberId: string;
      let who: string;

      if (/^(me|myself|my own|my)$/i.test(a.person.trim())) {
        if (!ctx.actorUserId) {
          return { error: "Your number isn't linked to a dashboard account." };
        }
        const self = await prisma.member.findFirst({
          where: { userId: ctx.actorUserId, organizationId: ctx.organizationId },
          select: { id: true, user: { select: { name: true } } },
        });
        if (!self) return { error: "Couldn't find your account." };
        memberId = self.id;
        who = "your own account";
      } else {
        const found = await findMember(ctx, a.person);
        if (!found.ok) return { error: found.error };
        memberId = found.row.id;
        who = found.row.user.name;
      }

      const { setUserPassword } = await import("@/app/(dashboard)/users/actions");
      const result = await setUserPassword(memberId, a.newPassword);

      if (!result.success) return { error: result.error };
      return {
        changed: true,
        person: who,
        message: `${result.message} Delete the message containing the password from this chat.`,
      };
    },
  },

  {
    name: "change_my_password",
    description:
      "Change your own password. Anyone can do this; it needs your current password to prove it is you.",
    requires: "readonly",
    writes: true,
    schema: z.object({
      currentPassword: z.string(),
      newPassword: z.string().describe("At least 8 characters"),
    }),
    handler: async (args, ctx) => {
      const a = args as { currentPassword: string; newPassword: string };

      if (!ctx.actorUserId) {
        return {
          error:
            "Your number isn't linked to a dashboard account, so there is no password to change. An admin links it under Settings.",
        };
      }

      const { changePassword } = await import(
        "@/app/(dashboard)/account/actions"
      );
      const result = await changePassword({
        currentPassword: a.currentPassword,
        newPassword: a.newPassword,
      });

      if (!result.success) return { error: result.error };
      return {
        changed: true,
        message:
          "Your password has been changed. Delete the message containing it from this chat.",
      };
    },
  },

  {
    name: "change_user_role",
    description: "Change what level of access someone has.",
    requires: "admin",
    writes: true,
    schema: z.object({
      person: z.string().describe("Their name or email"),
      role: z.enum(ROLES),
    }),
    handler: async (args, ctx) => {
      const a = args as { person: string; role: (typeof ROLES)[number] };
      const found = await findMember(ctx, a.person);
      if (!found.ok) return { error: found.error };

      if (found.row.role === a.role) {
        return { error: `${found.row.user.name} is already ${a.role}.` };
      }

      const { updateMemberRole } = await import(
        "@/app/(dashboard)/users/actions"
      );
      const result = await updateMemberRole(found.row.id, a.role);

      if (!result.success) return { error: result.error };
      return {
        changed: true,
        person: found.row.user.name,
        from: found.row.role,
        to: a.role,
      };
    },
  },

  {
    name: "remove_user",
    description:
      "Take away someone's access. Their records stay; only the login goes.",
    requires: "admin",
    writes: true,
    schema: z.object({
      person: z.string().describe("Their name or email"),
    }),
    handler: async (args, ctx) => {
      const a = args as { person: string };
      const found = await findMember(ctx, a.person);
      if (!found.ok) return { error: found.error };

      if (found.row.userId === ctx.actorUserId) {
        return { error: "You can't remove your own access." };
      }

      const { removeMember } = await import("@/app/(dashboard)/users/actions");
      const result = await removeMember(found.row.id);

      if (!result.success) return { error: result.error };
      return { removed: true, person: found.row.user.name };
    },
  },
];
