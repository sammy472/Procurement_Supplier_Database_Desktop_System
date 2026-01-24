import { db } from "../db";
import { getTable } from "./dbHelper";
import { like, desc } from "drizzle-orm";

export const generatePONumber = async (company?: string | null): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const purchaseOrdersTable = getTable("purchaseOrders", company);

  // Get the latest PO number for this year
  const latestPOs = await db
    .select()
    .from(purchaseOrdersTable)
    .where(like(purchaseOrdersTable.poNumber, `${prefix}%`))
    .orderBy(desc(purchaseOrdersTable.createdAt))
    .limit(1);

  let sequence = 1;
  if (latestPOs.length > 0) {
    const lastNumber = latestPOs[0].poNumber;
    const parts = lastNumber.split("-");
    const lastSequence = parseInt(parts[parts.length - 1] || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};
