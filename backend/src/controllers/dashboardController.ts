import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, gte, and, desc, sql, inArray } from "drizzle-orm";
import { getTable } from "../utils/dbHelper";

type SupplierRow = typeof schema.suppliers.$inferSelect;
type CountRow = { count: number };

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const company = req.user?.company;

    const suppliersTable = getTable("suppliers", company);
    const quotationsTable = getTable("quotations", company);
    const materialRequestsTable = getTable("materialRequests", company);
    const purchaseOrdersTable = getTable("purchaseOrders", company);
    const rfqsTable = getTable("rfqs", company);
    const tendersTable = getTable("tenders", company);

    // Total suppliers
    const totalSuppliers = (await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliersTable)
      .where(eq(suppliersTable.isActive, true))) as CountRow[];

    // Quotations created this month
    const quotationsThisMonth = (await db
      .select({ count: sql<number>`count(*)` })
      .from(quotationsTable)
      .where(gte(quotationsTable.createdAt, startOfMonth))) as CountRow[];

    // Active material requests (pending or approved)
    const activeRequests = (await db
      .select({ count: sql<number>`count(*)` })
      .from(materialRequestsTable)
      .where(
        sql`${materialRequestsTable.status} IN ('pending', 'approved')`
      )) as CountRow[];

    // RFQs stats
    const totalRFQs = (await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqsTable)) as CountRow[];

    const rfqsActive = (await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqsTable)
      .where(eq(rfqsTable.status, "active" as any))) as CountRow[];

    const rfqsSent = (await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqsTable)
      .where(eq(rfqsTable.status, "sent" as any))) as CountRow[];

    const rfqsClosed = (await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqsTable)
      .where(eq(rfqsTable.status, "closed" as any))) as CountRow[];

    // Tenders stats
    const totalTenders = (await db
      .select({ count: sql<number>`count(*)` })
      .from(tendersTable)) as CountRow[];

    const tendersDraft = (await db
      .select({ count: sql<number>`count(*)` })
      .from(tendersTable)
      .where(eq(tendersTable.status, "draft" as any))) as CountRow[];

    const tendersActive = (await db
      .select({ count: sql<number>`count(*)` })
      .from(tendersTable)
      .where(eq(tendersTable.status, "active" as any))) as CountRow[];

    const tendersClosed = (await db
      .select({ count: sql<number>`count(*)` })
      .from(tendersTable)
      .where(eq(tendersTable.status, "closed" as any))) as CountRow[];

    const tendersCancelled = (await db
      .select({ count: sql<number>`count(*)` })
      .from(tendersTable)
      .where(eq(tendersTable.status, "cancelled" as any))) as CountRow[];

    // Open purchase orders (draft, sent, delivered)
    const openPOs = (await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrdersTable)
      .where(
        sql`${purchaseOrdersTable.status} IN ('draft', 'sent', 'delivered')`
      )) as CountRow[];

    // Most frequently used suppliers (from purchase orders)
    const topSuppliers = (await db
      .select({
        supplierId: purchaseOrdersTable.supplierId,
        count: sql<number>`count(*)`,
      })
      .from(purchaseOrdersTable)
      .groupBy(purchaseOrdersTable.supplierId)
      .orderBy(desc(sql`count(*)`))
      .limit(5)) as { supplierId: string | null; count: number }[];

    // Get supplier details for top suppliers
    const supplierIds = topSuppliers.map((s) => s.supplierId).filter(Boolean);

    let supplierDetails: SupplierRow[] = [];
    if (supplierIds.length > 0) {
      supplierDetails = (await db
        .select()
        .from(suppliersTable)
        .where(inArray(suppliersTable.id, supplierIds))) as SupplierRow[];
    }

    // Quotation trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const quotationTrend = (await db
      .select({
        month: sql<string>`to_char(${quotationsTable.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)`,
      })
      .from(quotationsTable)
      .where(gte(quotationsTable.createdAt, sixMonthsAgo))
      .groupBy(sql`to_char(${quotationsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${quotationsTable.createdAt}, 'YYYY-MM')`)) as {
      month: string;
      count: number;
    }[];

    // RFQ trend (last 6 months)
    const rfqTrend = (await db
      .select({
        month: sql<string>`to_char(${rfqsTable.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)`,
      })
      .from(rfqsTable)
      .where(gte(rfqsTable.createdAt, sixMonthsAgo))
      .groupBy(sql`to_char(${rfqsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${rfqsTable.createdAt}, 'YYYY-MM')`)) as {
      month: string;
      count: number;
    }[];

    // Tender trend (last 6 months)
    const tenderTrend = (await db
      .select({
        month: sql<string>`to_char(${tendersTable.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)`,
      })
      .from(tendersTable)
      .where(gte(tendersTable.createdAt, sixMonthsAgo))
      .groupBy(sql`to_char(${tendersTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${tendersTable.createdAt}, 'YYYY-MM')`)) as {
      month: string;
      count: number;
    }[];

    res.json({
      stats: {
        totalSuppliers: parseInt(totalSuppliers[0]?.count?.toString() || "0"),
        quotationsThisMonth: parseInt(quotationsThisMonth[0]?.count?.toString() || "0"),
        activeRequests: parseInt(activeRequests[0]?.count?.toString() || "0"),
        openPOs: parseInt(openPOs[0]?.count?.toString() || "0"),
        rfqs: {
          total: parseInt(totalRFQs[0]?.count?.toString() || "0"),
          active: parseInt(rfqsActive[0]?.count?.toString() || "0"),
          sent: parseInt(rfqsSent[0]?.count?.toString() || "0"),
          closed: parseInt(rfqsClosed[0]?.count?.toString() || "0"),
        },
        tenders: {
          total: parseInt(totalTenders[0]?.count?.toString() || "0"),
          draft: parseInt(tendersDraft[0]?.count?.toString() || "0"),
          active: parseInt(tendersActive[0]?.count?.toString() || "0"),
          closed: parseInt(tendersClosed[0]?.count?.toString() || "0"),
          cancelled: parseInt(tendersCancelled[0]?.count?.toString() || "0"),
        },
      },
      topSuppliers: topSuppliers.map((ts) => {
        const supplier = supplierDetails.find((s) => s.id === ts.supplierId);
        return {
          ...supplier,
          orderCount: parseInt(ts.count?.toString() || "0"),
        };
      }),
      quotationTrend: quotationTrend.map((qt) => ({
        month: qt.month,
        count: parseInt(qt.count?.toString() || "0"),
      })),
      rfqTrend: rfqTrend.map((rt) => ({
        month: rt.month,
        count: parseInt(rt.count?.toString() || "0"),
      })),
      tenderTrend: tenderTrend.map((tt) => ({
        month: tt.month,
        count: parseInt(tt.count?.toString() || "0"),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
