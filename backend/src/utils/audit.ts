import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "./dbHelper";
import { Request } from "express";
import { AuthRequest } from "../middleware/auth";

export interface AuditLogData {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  previousValue?: any;
  newValue?: any;
  req?: Request;
  company?: string;
}

export const logActivity = async (data: AuditLogData) => {
  try {
    const ipAddress = data.req?.ip || data.req?.socket.remoteAddress || null;
    const userAgent = data.req?.headers["user-agent"] || null;
    
    // Try to get company from request user if available or explicitly provided
    let company: string | undefined | null = data.company;
    if (!company && data.req && (data.req as any).user) {
      company = (data.req as any).user.company;
    }

    const activityLogsTable = getTable("activityLogs", company);

    await db.insert(activityLogsTable).values({
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      description: data.description,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - audit logging should not break the main flow
  }
};
