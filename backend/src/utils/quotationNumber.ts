import { db } from "../db";
import { getTable } from "./dbHelper";
import { like, desc } from "drizzle-orm";

export const generateQuotationNumber = async (company?: string | null): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  const quotationsTable = getTable("quotations", company);

  // Get the latest quotation number for this year
  const latestQuotations = await db
    .select()
    .from(quotationsTable)
    .where(like(quotationsTable.quotationNumber, `${prefix}%`))
    .orderBy(desc(quotationsTable.createdAt))
    .limit(1);

  let sequence = 1;
  if (latestQuotations.length > 0) {
    const lastNumber = latestQuotations[0].quotationNumber;
    const parts = lastNumber.split("-");
    const lastSequence = parseInt(parts[parts.length - 1] || "0");
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};
