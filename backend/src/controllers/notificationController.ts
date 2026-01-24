import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { getTable } from "../utils/dbHelper";

type ActivityLogRow = typeof schema.activityLogs.$inferSelect;
type NotificationReadStatusRow = typeof schema.notificationReadStatus.$inferSelect;

/**
 * Get notifications for the current user
 * Supports filtering by read/unread status
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, limit = 50 } = req.query;
    const company = req.user?.company;

    const activityLogsTable = getTable("activityLogs", company);
    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const notifications = (await db
      .select({
        id: activityLogsTable.id,
        userId: activityLogsTable.userId,
        action: activityLogsTable.action,
        entityType: activityLogsTable.entityType,
        entityId: activityLogsTable.entityId,
        description: activityLogsTable.description,
        createdAt: activityLogsTable.createdAt,
        isRead: sql<boolean>`COALESCE(${notificationReadStatusTable.isRead}, false::boolean)`,
        readAt: notificationReadStatusTable.readAt,
        readStatusId: notificationReadStatusTable.id,
      })
      .from(activityLogsTable)
      .leftJoin(
        notificationReadStatusTable,
        and(
          eq(notificationReadStatusTable.activityLogId, activityLogsTable.id),
          eq(notificationReadStatusTable.userId, userId)
        )
      )
      .where(eq(activityLogsTable.userId, userId))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(Number(limit))) as (ActivityLogRow & {
      isRead: boolean;
      readAt: Date | null;
      readStatusId: string | null;
    })[];

    let filteredNotifications = notifications;

    if (status === "unread") {
      filteredNotifications = notifications.filter((n) => !n.isRead);
    } else if (status === "read") {
      filteredNotifications = notifications.filter((n) => n.isRead);
    }

    res.json({ notifications: filteredNotifications });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get unread notification count for current user
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;

    const activityLogsTable = getTable("activityLogs", company);
    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const [{ count }] = await db
      .select({
        count: sql<bigint>`COUNT(*)`,
      })
      .from(activityLogsTable)
      .leftJoin(
        notificationReadStatusTable,
        and(
          eq(notificationReadStatusTable.activityLogId, activityLogsTable.id),
          eq(notificationReadStatusTable.userId, userId)
        )
      )
      .where(
        and(
          eq(activityLogsTable.userId, userId),
          sql`COALESCE(${notificationReadStatusTable.isRead}, false) = false`
        )
      );

    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const existing = await db
      .select()
      .from(notificationReadStatusTable)
      .where(
        and(
          eq(notificationReadStatusTable.activityLogId, id),
          eq(notificationReadStatusTable.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(notificationReadStatusTable)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notificationReadStatusTable.id, existing[0].id));
    } else {
      await db.insert(notificationReadStatusTable).values({
        userId,
        activityLogId: id,
        isRead: true,
        readAt: new Date(),
      } as any);
    }

    res.json({ message: "Notification marked as read" });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark a notification as unread
 */
export const markAsUnread = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const existing = await db
      .select()
      .from(notificationReadStatusTable)
      .where(
        and(
          eq(notificationReadStatusTable.activityLogId, id),
          eq(notificationReadStatusTable.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(notificationReadStatusTable)
        .set({
          isRead: false,
          readAt: null,
        })
        .where(eq(notificationReadStatusTable.id, existing[0].id));
    }

    res.json({ message: "Notification marked as unread" });
  } catch (error: any) {
    console.error("Error marking notification as unread:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;

    const activityLogsTable = getTable("activityLogs", company);
    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const activityLogs = await db
      .select({ id: activityLogsTable.id })
      .from(activityLogsTable);

    const existingStatuses = await db
      .select()
      .from(notificationReadStatusTable)
      .where(eq(notificationReadStatusTable.userId, userId));

    const existingIds = new Set(existingStatuses.map((s) => s.activityLogId));

    if (existingStatuses.length > 0) {
      await db
        .update(notificationReadStatusTable)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notificationReadStatusTable.userId, userId));
    }

    const newStatuses = activityLogs
      .filter((log) => !existingIds.has(log.id))
      .map((log) => ({
        userId,
        activityLogId: log.id,
        isRead: true,
        readAt: new Date(),
      }));

    if (newStatuses.length > 0) {
      await db.insert(notificationReadStatusTable).values(newStatuses as NotificationReadStatusRow[]);
    }

    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    console.error("Error marking all as read:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a notification (soft delete)
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const activityLogsTable = getTable("activityLogs", company);

    const existing = await db
      .select()
      .from(activityLogsTable)
      .where(and(eq(activityLogsTable.id, id), eq(activityLogsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await db.delete(activityLogsTable).where(eq(activityLogsTable.id, id));

    res.json({ message: "Notification deleted" });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete all read notifications for current user
 */
export const deleteAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;

    const activityLogsTable = getTable("activityLogs", company);
    const notificationReadStatusTable = getTable("notificationReadStatus", company);

    const readLogs = await db
      .select({
        id: activityLogsTable.id,
      })
      .from(activityLogsTable)
      .leftJoin(
        notificationReadStatusTable,
        and(
          eq(notificationReadStatusTable.activityLogId, activityLogsTable.id),
          eq(notificationReadStatusTable.userId, userId)
        )
      )
      .where(and(eq(activityLogsTable.userId, userId), eq(notificationReadStatusTable.isRead, true)));

    const ids = readLogs.map((r) => r.id).filter((id): id is string => !!id);
    if (ids.length > 0) {
      await db
        .delete(activityLogsTable)
        .where(and(eq(activityLogsTable.userId, userId), inArray(activityLogsTable.id, ids)));
    }

    res.json({ message: "All read notifications deleted" });
  } catch (error: any) {
    console.error("Error deleting all read notifications:", error);
    res.status(500).json({ error: error.message });
  }
};
