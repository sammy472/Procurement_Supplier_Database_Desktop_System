import { db } from "../db";
import { getTable } from "./dbHelper";
import { like, desc } from "drizzle-orm";

export const generateRequestNumber = async (company?: string | null): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  
  const requestsTable = getTable("materialRequests", company);

  // Get the latest request number for this year
  const latestRequests = await db
    .select()
    .from(requestsTable)
    .where(like(requestsTable.requestNumber, `${prefix}%`))
    .orderBy(desc(requestsTable.createdAt))
    .limit(1);

  let sequence = 1;
  if (latestRequests.length > 0) {
    const lastNumber = latestRequests[0].requestNumber;
    const parts = lastNumber.split("-");
    const lastSequence = parseInt(parts[parts.length - 1] || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};
