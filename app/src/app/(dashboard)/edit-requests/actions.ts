"use server";

/**
 * Approving and refusing the changes non-admins have asked for.
 *
 * What this replaces: a hand-written `switch (entityType)` that rebuilt each
 * update itself and got several of them wrong — writing a driver
 * `licenseExpiry` and a customer `city`, neither of which exist; skipping
 * relations and dates; never recomputing an invoice's balance. And it only
 * covered four entities, all of which stored `proposedData: {}`, so approving
 * one applied nothing at all.
 *
 * Approval now replays the change through the entity's own update action (see
 * lib/edit-requests/registry.ts), so every side effect is defined once.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole, requireAuth } from "@/lib/session";
import { notifyUsers } from "@/lib/notifications";
import {
  registryFor,
  rehydrate,
  type EditRequestEntity,
} from "@/lib/edit-requests/registry";
import { beginReplay, endReplay } from "@/lib/edit-requests/gate";

export interface DiffRow {
  field: string;
  label: string;
  /** The value when the request was raised. */
  original: unknown;
  /** The value now, which may have moved on since. */
  current: unknown;
  proposed: unknown;
  changed: boolean;
  /** True when the record changed under the request. */
  conflicted: boolean;
  isMoney: boolean;
}

/**
 * Builds the before/after view, plus the three-way comparison that catches a
 * record someone else has edited since the request was raised.
 */
export async function getEditRequestDiff(id: string): Promise<{
  success: boolean;
  error?: string;
  rows?: DiffRow[];
  conflicted?: boolean;
  entityMissing?: boolean;
  href?: string;
}> {
  // Admin only, matching the page. Org-scoping alone was not enough: any
  // signed-in colleague could read the before-and-after of any request,
  // which is the whole content of the record being changed.
  const session = await assertRole(["admin"]);

  const request = await prisma.editRequest.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  const entry = registryFor(request.entityType);
  if (!entry) {
    return { success: false, error: `Unknown record type: ${request.entityType}` };
  }

  const original = (request.originalData ?? {}) as Record<string, unknown>;
  const proposed = (request.proposedData ?? {}) as Record<string, unknown>;
  const snapshot = await entry.snapshot(
    request.entityId,
    session.organizationId,
  );

  if (!snapshot) {
    return {
      success: true,
      entityMissing: true,
      rows: [],
      href: entry.href(request.entityId),
    };
  }

  const current = JSON.parse(JSON.stringify(snapshot.data)) as Record<
    string,
    unknown
  >;

  const money = new Set(entry.moneyFields ?? []);
  const fields = [
    ...new Set([...Object.keys(original), ...Object.keys(proposed)]),
  ];

  const rows: DiffRow[] = fields
    .map((field) => {
      const originalValue = original[field] ?? null;
      const currentValue = current[field] ?? null;
      const proposedValue = proposed[field] ?? null;
      return {
        field,
        label: entry.fieldLabels[field] ?? field,
        original: originalValue,
        current: currentValue,
        proposed: proposedValue,
        changed: !sameValue(originalValue, proposedValue),
        // The record moved under the request: approving will overwrite
        // whatever changed it.
        conflicted: !sameValue(originalValue, currentValue),
        isMoney: money.has(field),
      };
    })
    // Only rows that are actually part of the decision.
    .filter((row) => row.changed || row.conflicted);

  return {
    success: true,
    rows,
    conflicted: rows.some((row) => row.conflicted),
    href: entry.href(request.entityId),
  };
}

/** Structural equality that survives the JSON round-trip both sides went through. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // Order of linked ids isn't meaningful, so compare as sets.
    const left = [...a].map(String).sort();
    const right = [...b].map(String).sort();
    return left.every((value, index) => value === right[index]);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Accepts a request and writes the change.
 *
 * The change is replayed through the entity's real update action in this
 * admin's session, so account reversals, invoice balances, supplier balances
 * and join-table relinks all happen exactly as they would for a direct edit.
 * If applying fails the request stays pending with the reason attached,
 * rather than being marked approved over a record that never changed.
 */
export async function approveEditRequest(id: string) {
  const session = await assertRole(["admin"]);

  const request = await prisma.editRequest.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!request) {
    return { success: false, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return { success: false, error: `This request was already ${request.status}.` };
  }

  const entry = registryFor(request.entityType);
  if (!entry) {
    return { success: false, error: `Unknown record type: ${request.entityType}` };
  }

  const proposed = (request.proposedData ?? {}) as Record<string, unknown>;

  let result: { success: boolean; error?: string };
  beginReplay();
  try {
    result =
      request.action === "delete"
        ? await entry.applyDelete(request.entityId)
        : await entry.apply(
            request.entityId,
            rehydrate(request.entityType as EditRequestEntity, proposed),
          );
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Could not apply the change",
    };
  } finally {
    endReplay();
  }

  if (!result.success) {
    // Left pending deliberately: a half-applied change marked approved is
    // worse than one the admin can look at and retry.
    await prisma.editRequest.update({
      where: { id },
      data: { applyError: result.error ?? "Could not apply the change" },
    });
    return {
      success: false,
      error: result.error ?? "Could not apply the change. Nothing was written.",
    };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: "approved",
      approvedById: session.user.id,
      approvedAt: new Date(),
      appliedAt: new Date(),
      applyError: null,
    },
  });

  await notifyUsers({
    userIds: [request.requestedById],
    organizationId: session.organizationId,
    entityType: "edit_request",
    entityId: request.id,
    title: request.action === "delete" ? "Delete approved" : "Change approved",
    message: `${session.user.name} accepted your change to ${request.entityLabel ?? entry.singular}.`,
    link: request.action === "delete" ? "/edit-requests" : entry.href(request.entityId),
    category: "edit_request_approved",
    excludeUserEmails: [session.user.email],
  });

  revalidatePath("/edit-requests");
  revalidatePath(entry.href(request.entityId));
  return { success: true };
}

/** Refuses a request. Nothing is written to the record. */
export async function rejectEditRequest(id: string, rejectionReason?: string) {
  const session = await assertRole(["admin"]);

  const reason = (rejectionReason ?? "").trim();
  if (reason.length < 3) {
    return {
      success: false,
      error: "Say why you're turning this down — the requester only sees this.",
    };
  }

  const request = await prisma.editRequest.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!request) {
    return { success: false, error: "Request not found" };
  }
  if (request.status !== "pending") {
    return { success: false, error: `This request was already ${request.status}.` };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: "rejected",
      approvedById: session.user.id,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });

  const entry = registryFor(request.entityType);

  await notifyUsers({
    userIds: [request.requestedById],
    organizationId: session.organizationId,
    entityType: "edit_request",
    entityId: request.id,
    title: "Change turned down",
    message: `${session.user.name} turned down your change to ${
      request.entityLabel ?? entry?.singular ?? "a record"
    }: ${reason}`,
    link: "/edit-requests",
    category: "edit_request_rejected",
    excludeUserEmails: [session.user.email],
  });

  revalidatePath("/edit-requests");
  return { success: true };
}

/**
 * Withdraws a request the signed-in user raised themselves.
 *
 * Without this, a supervisor who made a mistake had to ask an admin to reject
 * their own typo — and the one-pending-per-record rule meant they could not
 * send a corrected version until somebody did.
 */
export async function withdrawEditRequest(id: string) {
  const session = await requireAuth();

  const request = await prisma.editRequest.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!request) {
    return { success: false, error: "Request not found" };
  }
  if (request.requestedById !== session.user.id) {
    return { success: false, error: "You can only withdraw your own requests." };
  }
  if (request.status !== "pending") {
    return { success: false, error: `This request was already ${request.status}.` };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: "rejected",
      rejectionReason: "Withdrawn by the requester",
      approvedAt: new Date(),
    },
  });

  revalidatePath("/edit-requests");
  return { success: true };
}
