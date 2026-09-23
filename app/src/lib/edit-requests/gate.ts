import "server-only";

/**
 * The gate every update and delete action passes through.
 *
 * The rule the client has now asked for three rounds running: an admin edits
 * directly; anyone else's edit becomes a request an admin accepts or refuses.
 * Creating records stays direct for supervisors and staff — it is only
 * changing and removing existing ones that needs review.
 *
 * Call it at the top of an action, after validation and before any write:
 *
 *   const gate = await gateChange({ entityType: "truck", entityId: id, data });
 *   if (!gate.proceed) return gate.response;
 *   // ... the existing update body, unchanged
 *
 * Everything below `if (!gate.proceed)` therefore runs either because the
 * caller is an admin, or because an admin approved the request — in which
 * case approval is itself running in the admin's session. That is what lets
 * every side effect stay defined once, in the action, instead of being
 * duplicated into an approval path that drifts.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, type ServerSession } from "@/lib/session";
import { canEditDirectly, canDeleteDirectly } from "@/lib/permissions";
import { notifyByTierKey } from "@/lib/notifications";
import {
  registryFor,
  serialiseForRequest,
  type EditRequestEntity,
} from "@/lib/edit-requests/registry";

export interface GateResponse {
  success: true;
  /** Tells the form to say "sent for approval" rather than "saved". */
  pendingApproval: true;
  editRequestId: string;
  message: string;
}

export type GateResult =
  | { proceed: true; session: ServerSession }
  | { proceed: false; response: GateResponse | { success: false; error: string } };

/**
 * Set by `approveEditRequest` while it replays a change, so the update action
 * it calls doesn't turn round and file a second request for the same edit.
 *
 * A module-level flag is safe here because a server action runs to completion
 * within one request before the next one is handled, and approval never
 * awaits anything that could interleave another approval on the same worker.
 */
let replaying = false;

export function beginReplay() {
  replaying = true;
}

export function endReplay() {
  replaying = false;
}

export function isReplaying() {
  return replaying;
}

export async function gateChange(params: {
  entityType: EditRequestEntity;
  entityId: string;
  /** The validated payload; stored as `proposedData`. */
  data: Record<string, unknown>;
  /** Why the change is wanted. Required for non-admins. */
  reason?: string;
  /** "update" files an edit, "delete" files a removal. */
  action?: "update" | "delete";
}): Promise<GateResult> {
  const session = await requireAuth();

  // An admin replaying an approved request must not file another one.
  if (isReplaying()) {
    return { proceed: true, session };
  }

  const allowed =
    params.action === "delete"
      ? canDeleteDirectly(session.role)
      : canEditDirectly(session.role);

  if (allowed) {
    return { proceed: true, session };
  }

  const entry = registryFor(params.entityType);
  if (!entry) {
    return {
      proceed: false,
      response: {
        success: false,
        error: `Changes to ${params.entityType} cannot be requested yet. Ask an admin to make this change.`,
      },
    };
  }

  const reason = (params.reason ?? "").trim();
  if (reason.length < 5) {
    return {
      proceed: false,
      response: {
        success: false,
        error: "Give a short reason for this change so the admin knows why.",
      },
    };
  }

  const snapshot = await entry.snapshot(params.entityId, session.organizationId);
  if (!snapshot) {
    return {
      proceed: false,
      response: { success: false, error: `${entry.singular} not found` },
    };
  }

  // At most one pending request per record — the database enforces this with a
  // partial unique index, but checking first gives a message worth reading.
  const existing = await prisma.editRequest.findFirst({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
      status: "pending",
    },
    include: { requestedBy: { select: { name: true } } },
  });

  if (existing) {
    return {
      proceed: false,
      response: {
        success: false,
        error: `${snapshot.label} already has a change waiting for approval (requested by ${existing.requestedBy.name}). It has to be accepted or refused before another can be sent.`,
      },
    };
  }

  const request = await prisma.editRequest.create({
    data: {
      organizationId: session.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action ?? "update",
      entityLabel: snapshot.label,
      // Only the fields the form can change, so the diff has no noise from
      // ids and timestamps.
      originalData: serialiseForRequest(snapshot.data),
      proposedData: serialiseForRequest(params.data),
      reason,
      requestedById: session.user.id,
      status: "pending",
    },
  });

  await notifyByTierKey({
    key: "edit_request_created",
    organizationId: session.organizationId,
    title:
      params.action === "delete"
        ? `${session.user.name} wants to delete a record`
        : `${session.user.name} wants to change a record`,
    message: `${snapshot.label} — ${reason}`,
    link: `/edit-requests?highlight=${request.id}`,
    entityType: "edit_request",
    entityId: request.id,
    excludeUserEmails: [session.user.email],
    metadata: { entityType: params.entityType, entityId: params.entityId },
  });

  return {
    proceed: false,
    response: {
      success: true,
      pendingApproval: true,
      editRequestId: request.id,
      message:
        params.action === "delete"
          ? "Sent to an admin for approval. The record has not been deleted yet."
          : "Sent to an admin for approval. The record is unchanged until they accept it.",
    },
  };
}

/** True when this record already has a change waiting, so the UI can say so. */
export async function pendingRequestFor(
  entityType: string,
  entityId: string,
): Promise<{ id: string; requestedBy: string; action: string } | null> {
  const request = await prisma.editRequest.findFirst({
    where: { entityType, entityId, status: "pending" },
    include: { requestedBy: { select: { name: true } } },
  });

  return request
    ? {
        id: request.id,
        requestedBy: request.requestedBy.name,
        action: request.action,
      }
    : null;
}
