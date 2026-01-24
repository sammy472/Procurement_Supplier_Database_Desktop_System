import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, desc, and, gte } from "drizzle-orm";

type ActivityLogRow = typeof schema.activityLogs.$inferSelect;

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, userId, limit = 100 } = req.query;
    const company = req.user?.company;
    const activityLogsTable = getTable("activityLogs", company);

    const conditions = [];

    if (entityType) {
      conditions.push(eq(activityLogsTable.entityType, entityType as string));
    }

    if (entityId) {
      conditions.push(eq(activityLogsTable.entityId, entityId as string));
    }

    if (userId) {
      conditions.push(eq(activityLogsTable.userId, userId as string));
    }

    let logs: ActivityLogRow[];
    if (conditions.length > 0) {
      logs = (await db
        .select()
        .from(activityLogsTable)
        .where(and(...conditions))
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(parseInt(limit as string))) as ActivityLogRow[];
    } else {
      logs = (await db
        .select()
        .from(activityLogsTable)
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(parseInt(limit as string))) as ActivityLogRow[];
    }

    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
