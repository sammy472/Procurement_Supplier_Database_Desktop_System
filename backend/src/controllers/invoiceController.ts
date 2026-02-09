import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, like, or, desc } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import fs from "fs";
import path from "path";
import { downloadFile, STORAGE_BUCKETS, getPublicUrl } from "../utils/supabaseStorage";

type InvoiceRow = typeof schema.invoices.$inferSelect;

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const invoicesTable = getTable("invoices", req.user?.company);

    let query = db.select().from(invoicesTable);

    if (search) {
      const baseQuery = db
        .select()
        .from(invoicesTable)
        .where(
          or(
            like(invoicesTable.invoiceNumber, `%${search}%`),
            like(invoicesTable.clientName, `%${search}%`)
          )!
        )
        .orderBy(desc(invoicesTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const invoices = (await qb) as InvoiceRow[];
      const withUrls = invoices.map((inv) => {
        let pdfUrl: string | undefined;
        if (inv.pdfPath && !String(inv.pdfPath).includes(":") && !String(inv.pdfPath).includes("\\")) {
          try {
            pdfUrl = getPublicUrl(STORAGE_BUCKETS.GENERAL_DOCUMENTS, String(inv.pdfPath));
          } catch {}
        }
        return { ...inv, pdfUrl };
      });
      return res.json({ invoices: withUrls });
    }

    if (status) {
      const baseQuery = db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.status, status as any))
        .orderBy(desc(invoicesTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const invoices = (await qb) as InvoiceRow[];
      const withUrls = invoices.map((inv) => {
        let pdfUrl: string | undefined;
        if (inv.pdfPath && !String(inv.pdfPath).includes(":") && !String(inv.pdfPath).includes("\\")) {
          try {
            pdfUrl = getPublicUrl(STORAGE_BUCKETS.GENERAL_DOCUMENTS, String(inv.pdfPath));
          } catch {}
        }
        return { ...inv, pdfUrl };
      });
      return res.json({ invoices: withUrls });
    }

    const baseQuery = db
      .select()
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.createdAt));
    let qb: any = baseQuery;
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const invoices = (await qb) as InvoiceRow[];
    const withUrls = invoices.map((inv) => {
      let pdfUrl: string | undefined;
      if (inv.pdfPath && !String(inv.pdfPath).includes(":") && !String(inv.pdfPath).includes("\\")) {
        try {
          pdfUrl = getPublicUrl(STORAGE_BUCKETS.GENERAL_DOCUMENTS, String(inv.pdfPath));
        } catch {}
      }
      return { ...inv, pdfUrl };
    });

    res.json({ invoices: withUrls });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invoicesTable = getTable("invoices", req.user?.company);

    const invoices = (await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1)) as InvoiceRow[];

    if (invoices.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const inv = invoices[0];
    let pdfUrl: string | undefined;
    if (inv.pdfPath && !String(inv.pdfPath).includes(":") && !String(inv.pdfPath).includes("\\")) {
      try {
        pdfUrl = getPublicUrl(STORAGE_BUCKETS.GENERAL_DOCUMENTS, String(inv.pdfPath));
      } catch {}
    }
    res.json({ invoice: { ...inv, pdfUrl } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const invoicesTable = getTable("invoices", req.user?.company);

    const existing = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Exclude fields that shouldn't be updated directly or handle them carefully
    // For now allow partial update of body
    const { id: _, createdAt, ...updateData } = data;

    const updated = await db
      .update(invoicesTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, id))
      .returning();

    await logActivity({
      userId: req.user!.id,
      action: "Updated invoice",
      entityType: "invoices",
      entityId: id,
      description: `Invoice ${existing[0].invoiceNumber} updated`,
      req: req
    });

    res.json({ invoice: updated[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoicesTable = getTable("invoices", req.user?.company);

    const existing = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));

    await logActivity({
      userId: req.user!.id,
      action: "Deleted invoice",
      entityType: "invoices",
      entityId: id,
      description: `Invoice ${existing[0].invoiceNumber} deleted`,
      req: req
    });

    res.json({ message: "Invoice deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const {
      invoiceNumber,
      quotationNumber,
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      baseInvoiceId,
      pricingRuleSnapshot,
      companyProfileSnapshot,
      items,
      subtotal,
      taxTotal,
      total,
      currency,
      pdfPath,
      status
    } = req.body;

    const invoicesTable = getTable("invoices", req.user?.company);

    // Check if invoice number exists
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, invoiceNumber))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Invoice number already exists" });
    }

    const [newInvoice] = (await db
      .insert(invoicesTable)
      .values({
        invoiceNumber,
        quotationNumber,
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        baseInvoiceId,
        pricingRuleSnapshot,
        companyProfileSnapshot,
        items,
        subtotal,
        taxTotal: taxTotal || 0,
        total,
        currency,
        pdfPath,
        status: status || "generated",
        createdBy: req.user?.id,
      })
      .returning()) as InvoiceRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create_invoice",
      entityType: "invoice",
      entityId: newInvoice.id,
      description: `Created invoice ${invoiceNumber}`,
      req: req
    });

    res.status(201).json({ invoice: newInvoice });
  } catch (error: any) {
    console.error("Create invoice error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const exportInvoicePDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inline = req.query.view === "true";
    const invoicesTable = getTable("invoices", req.user?.company);
    const invoices = (await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1)) as InvoiceRow[];
    if (invoices.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const inv = invoices[0];
    const name = inv.invoiceNumber ? `invoice-${inv.invoiceNumber}.pdf` : "invoice.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename=${name}`);
    try {
      if (inv.pdfPath && !inv.pdfPath.includes("\\") && !inv.pdfPath.includes(":")) {
        const buffer = await downloadFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, String(inv.pdfPath));
        res.send(buffer);
        return;
      }
      const localPath = inv.pdfPath
        ? String(inv.pdfPath)
        : path.join(process.cwd(), "generated-invoices", `${inv.invoiceNumber}.pdf`);
      await fs.promises.access(localPath, fs.constants.R_OK);
      fs.createReadStream(localPath).pipe(res);
    } catch {
      return res.status(404).json({ error: "PDF file not found" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
