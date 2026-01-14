"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function getUserNotifications() {
  const session = await requireAuth();

  try {
    const notifications = await prisma.userNotification.findMany({
      where: {
        userId: session.user.id,
        isDismissed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to 50 most recent
    });

    return { success: true, notifications };
  } catch (error) {
    console.error("Failed to get notifications:", error);
    return { success: false, error: "Failed to get notifications", notifications: [] };
  }
}

export async function getUnreadNotificationCount() {
  const session = await requireAuth();

  try {
    const count = await prisma.userNotification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        isDismissed: false,
      },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return { success: false, error: "Failed to get unread count", count: 0 };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const session = await requireAuth();

  try {
    await prisma.userNotification.updateMany({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark as read:", error);
    return { success: false, error: "Failed to mark as read" };
  }
}

export async function markAllNotificationsAsRead() {
  const session = await requireAuth();

  try {
    await prisma.userNotification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return { success: false, error: "Failed to mark all as read" };
  }
}

export async function dismissNotification(notificationId: string) {
  const session = await requireAuth();

  try {
    await prisma.userNotification.updateMany({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to dismiss notification:", error);
    return { success: false, error: "Failed to dismiss notification" };
  }
}

export async function createNotification(data: {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  metadata?: any;
}) {
  try {
    const notification = await prisma.userNotification.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        link: data.link,
        metadata: data.metadata,
      },
    });

    return { success: true, notification };
  } catch (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}
