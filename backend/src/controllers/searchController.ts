import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { like, or } from "drizzle-orm";
import { getTable } from "../utils/dbHelper";

type SupplierRow = typeof schema.suppliers.$inferSelect;
type MaterialRow = typeof schema.materials.$inferSelect;
type QuotationRow = typeof schema.quotations.$inferSelect;
type PurchaseOrderRow = typeof schema.purchaseOrders.$inferSelect;

export const globalSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    const company = req.user?.company;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchTerm = `%${q}%`;

    const suppliersTable = getTable("suppliers", company);
    const materialsTable = getTable("materials", company);
    const quotationsTable = getTable("quotations", company);
    const purchaseOrdersTable = getTable("purchaseOrders", company);

    // Search suppliers
    const suppliers = (await db
      .select()
      .from(suppliersTable)
      .where(
        or(
          like(suppliersTable.name, searchTerm),
          like(suppliersTable.email, searchTerm),
          like(suppliersTable.contactPerson, searchTerm),
          like(suppliersTable.category, searchTerm)
        )!
      )
      .limit(10)) as SupplierRow[];

    // Search materials
    const materials = (await db
      .select()
      .from(materialsTable)
      .where(
        or(
          like(materialsTable.name, searchTerm),
          like(materialsTable.partNumber, searchTerm),
          like(materialsTable.description, searchTerm),
          like(materialsTable.category, searchTerm),
          like(materialsTable.brand, searchTerm)
        )!
      )
      .limit(10)) as MaterialRow[];

    // Search quotations
    const quotations = (await db
      .select()
      .from(quotationsTable)
      .where(
        or(
          like(quotationsTable.quotationNumber, searchTerm),
          like(quotationsTable.clientName, searchTerm),
          like(quotationsTable.projectTitle, searchTerm),
          like(quotationsTable.projectReference, searchTerm)
        )!
      )
      .limit(10)) as QuotationRow[];

    // Search purchase orders
    const purchaseOrders = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(like(purchaseOrdersTable.poNumber, searchTerm))
      .limit(10)) as PurchaseOrderRow[];

    res.json({
      suppliers,
      materials,
      quotations,
      purchaseOrders,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
