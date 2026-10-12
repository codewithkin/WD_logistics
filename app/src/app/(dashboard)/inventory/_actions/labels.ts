"use server";

/**
 * The storeroom's own labels: Brakes, Filters, Oils, Tyres.
 *
 * `InventoryItem.category` was free text typed into a plain input, so a fleet
 * ended up with "Brakes", "brakes" and "Brake Parts" as three separate
 * categories, and the inventory list had no filter by any of them — the only
 * grouping in the product was an admin-only value rollup. The client asked for
 * proper organisation, user-defined.
 *
 * Admin **and supervisor** can manage these, which is deliberate and differs
 * from expense categories. A label is how the people in the storeroom find a
 * part; an `ExpenseCategory` is the chart of accounts and stays admin-only
 * (ACCESS_CONTROL.md). Staff keep no inventory access at all, per the same
 * document and confirmed with the client on 12 Oct.
 *
 * Labels are created, renamed and removed **directly**, not through the
 * edit-request queue. They are organisational metadata, not business records:
 * nothing about money or the fleet changes when "Oils" becomes "Lubricants",
 * and sending it to an admin for approval would mean a supervisor cannot tidy
 * their own shelves. The items a label is attached to are of course still
 * gated as they were.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/session";

export interface InventoryLabelRow {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  /** How many items carry it, so a delete can say what it will affect. */
  itemCount: number;
}

function revalidateInventory() {
  revalidatePath("/inventory");
}

/** A tidy name: trimmed, and never two labels differing only by case. */
function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function listInventoryLabels(): Promise<InventoryLabelRow[]> {
  const session = await assertRole(["admin", "supervisor"]);

  const labels = await prisma.inventoryLabel.findMany({
    where: { organizationId: session.organizationId },
    include: { _count: { select: { items: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    sortOrder: label.sortOrder,
    itemCount: label._count.items,
  }));
}

export async function createInventoryLabel(data: { name: string; color?: string | null }) {
  const session = await assertRole(["admin", "supervisor"]);

  const name = cleanName(data.name);
  if (name.length < 2) {
    return { success: false as const, error: "Give the label a name of at least two characters." };
  }

  // Case-insensitively, because the whole point is to stop "Brakes" and
  // "brakes" existing side by side. The unique index is case-sensitive, so
  // this check is the one that matters.
  const clash = await prisma.inventoryLabel.findFirst({
    where: {
      organizationId: session.organizationId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { name: true },
  });
  if (clash) {
    return { success: false as const, error: `There is already a label called "${clash.name}".` };
  }

  const highest = await prisma.inventoryLabel.findFirst({
    where: { organizationId: session.organizationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const label = await prisma.inventoryLabel.create({
    data: {
      organizationId: session.organizationId,
      name,
      color: data.color || null,
      sortOrder: (highest?.sortOrder ?? 0) + 1,
    },
  });

  revalidateInventory();
  return { success: true as const, label: { id: label.id, name: label.name } };
}

export async function renameInventoryLabel(id: string, data: { name: string; color?: string | null }) {
  const session = await assertRole(["admin", "supervisor"]);

  const name = cleanName(data.name);
  if (name.length < 2) {
    return { success: false as const, error: "Give the label a name of at least two characters." };
  }

  const existing = await prisma.inventoryLabel.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false as const, error: "Label not found" };
  }

  const clash = await prisma.inventoryLabel.findFirst({
    where: {
      organizationId: session.organizationId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
    select: { name: true },
  });
  if (clash) {
    return { success: false as const, error: `There is already a label called "${clash.name}".` };
  }

  // One write, and every item carrying the label reads as renamed — which is
  // the whole reason this is a table and not a string on each row.
  await prisma.inventoryLabel.update({
    where: { id },
    data: { name, ...(data.color !== undefined && { color: data.color || null }) },
  });

  revalidateInventory();
  return { success: true as const };
}

/**
 * Remove a label. The items keep existing and simply become unlabelled.
 *
 * Deliberately not a refusal when the label is in use: a storeroom
 * reorganising itself should not have to clear fifty items by hand first. The
 * caller is told how many it affected so the message can say so.
 */
export async function deleteInventoryLabel(id: string) {
  const session = await assertRole(["admin", "supervisor"]);

  const label = await prisma.inventoryLabel.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { _count: { select: { items: true } } },
  });
  if (!label) {
    return { success: false as const, error: "Label not found" };
  }

  // The FK is SetNull, so the items are detached by the delete itself; this
  // is only here to report the number.
  const affected = label._count.items;
  await prisma.inventoryLabel.delete({ where: { id } });

  revalidateInventory();
  return {
    success: true as const,
    affected,
    message:
      affected === 0
        ? `"${label.name}" removed.`
        : `"${label.name}" removed — ${affected} ${affected === 1 ? "item is" : "items are"} now unlabelled.`,
  };
}

/** Reorder the filter tabs. Takes the ids in the order they should appear. */
export async function reorderInventoryLabels(ids: string[]) {
  const session = await assertRole(["admin", "supervisor"]);

  const mine = await prisma.inventoryLabel.findMany({
    where: { id: { in: ids }, organizationId: session.organizationId },
    select: { id: true },
  });
  const allowed = new Set(mine.map((label) => label.id));

  await prisma.$transaction(
    ids
      .filter((id) => allowed.has(id))
      .map((id, index) =>
        prisma.inventoryLabel.update({ where: { id }, data: { sortOrder: index } }),
      ),
  );

  revalidateInventory();
  return { success: true as const };
}
