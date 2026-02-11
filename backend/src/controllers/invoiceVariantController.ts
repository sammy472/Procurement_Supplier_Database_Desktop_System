import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { generatePdfBufferFromHtml } from "../services/invoice-variant-engine/pdf.generator";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable, getCompanyFromEmail } from "../utils/dbHelper";
import { AuthRequest } from "../middleware/auth";
import { uploadFile, STORAGE_BUCKETS, generateFilePath } from "../utils/supabaseStorage";

export async function generateVariantsHandler(req: AuthRequest, res: Response) {
  try {
    const payload = {
      invoiceMeta: req.body.invoiceMeta ? (typeof req.body.invoiceMeta === "string" ? JSON.parse(req.body.invoiceMeta) : req.body.invoiceMeta) : undefined,
      buyerProfiles: req.body.buyerProfiles ? (typeof req.body.buyerProfiles === "string" ? JSON.parse(req.body.buyerProfiles) : req.body.buyerProfiles) : undefined,
    };
    const itemsPayload = Array.isArray(req.body.items)
      ? req.body.items
      : (typeof req.body.items === "string" ? JSON.parse(req.body.items) : []);

    const htmlRaw = typeof req.body.html === "string" ? req.body.html : (typeof req.body.invoiceHtml === "string" ? req.body.invoiceHtml : undefined);
    if (!htmlRaw) {
      return res.status(400).json({ success: false, error: "Missing HTML template" });
    }
    {
      const invNum = String(payload.invoiceMeta?.invoiceNumber || uuidv4());
      const pdfBuffer = await generatePdfBufferFromHtml(htmlRaw);
      const filePath = generateFilePath("invoices", `${invNum}.pdf`, req.user?.id);
      const { path: storagePath, url: publicUrl } = await uploadFile(
        STORAGE_BUCKETS.GENERAL_DOCUMENTS,
        filePath,
        pdfBuffer,
        "application/pdf"
      );
      const generatedUrls = [{ inline: publicUrl, download: publicUrl }];
      try {
        const computedCompany =
          (req.user?.company && req.user.company.toUpperCase()) ||
          (req.user?.email ? getCompanyFromEmail(req.user.email) : "ONK_GROUP");
        let invoicesTable: any;
        try {
          invoicesTable = getTable("invoices", computedCompany);
        } catch {
          invoicesTable = schema.invoices;
        }
        const client = (payload.buyerProfiles && payload.buyerProfiles[0]) || {};
        const rows = (await db
          .insert(invoicesTable)
          .values({
            invoiceNumber: payload.invoiceMeta?.invoiceNumber || invNum,
            quotationNumber: payload.invoiceMeta?.quotationNumber || null,
            clientName: String((client as any).name || payload.invoiceMeta?.clientName || "Client"),
            clientAddress: (client as any).address || payload.invoiceMeta?.clientAddress || null,
            clientEmail: (client as any).email || payload.invoiceMeta?.clientEmail || null,
            clientPhone: (client as any).phone || payload.invoiceMeta?.clientPhone || null,
            baseInvoiceId: null,
            pricingRuleSnapshot: null,
            companyProfileSnapshot: payload.invoiceMeta?.companyProfile || null,
            items: Array.isArray(itemsPayload) ? itemsPayload : [],
            subtotal: Number(payload.invoiceMeta?.subtotal || 0),
            taxTotal: Number(payload.invoiceMeta?.taxTotal || 0),
            total: Number(payload.invoiceMeta?.total || 0),
            currency: String(payload.invoiceMeta?.currency || "USD"),
            pdfPath: storagePath,
            status: "generated",
            createdBy: req.user?.id || null,
          })
          .returning()) as any[];
        const row = Array.isArray(rows) ? rows[0] : undefined;
        return res.json({ success: true, generatedFiles: [storagePath], generatedUrls, savedCount: row && row.id ? 1 : 0 });
      } catch (persistErr) {
        console.error("Persisting HTML-generated invoice failed:", persistErr);
        return res.json({ success: true, generatedFiles: [storagePath], generatedUrls, savedCount: 0, warn: "Generated but not saved to DB" });
      }
    }
  } catch (error: any) {
    console.error("Invoice variant generation error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}

export async function uploadClientPdfHandler(req: AuthRequest, res: Response) {
  try {
    const payload = {
      invoiceMeta: req.body.invoiceMeta ? (typeof req.body.invoiceMeta === "string" ? JSON.parse(req.body.invoiceMeta) : req.body.invoiceMeta) : undefined,
      buyerProfiles: req.body.buyerProfiles ? (typeof req.body.buyerProfiles === "string" ? JSON.parse(req.body.buyerProfiles) : req.body.buyerProfiles) : undefined,
    };
    const itemsPayload = Array.isArray(req.body.items)
      ? req.body.items
      : (typeof req.body.items === "string" ? JSON.parse(req.body.items) : []);
    const invNum = String(payload.invoiceMeta?.invoiceNumber || uuidv4());
    let pdfBuffer: Buffer | undefined;
    let fileName = `${invNum}.pdf`;
    if (req.file && req.file.buffer) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname || fileName;
    } else if (typeof req.body.pdfBase64 === "string" && req.body.pdfBase64.trim()) {
      const base64 = req.body.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      pdfBuffer = Buffer.from(base64, "base64");
    }
    if (!pdfBuffer) {
      return res.status(400).json({ success: false, error: "No PDF provided" });
    }
    const filePath = generateFilePath("invoices", fileName, req.user?.id);
    const { path: storagePath, url: publicUrl } = await uploadFile(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      filePath,
      pdfBuffer,
      "application/pdf"
    );
    const generatedUrls = [{ inline: publicUrl, download: publicUrl }];
    try {
      const computedCompany =
        (req.user?.company && req.user.company.toUpperCase()) ||
        (req.user?.email ? getCompanyFromEmail(req.user.email) : "ONK_GROUP");
      let invoicesTable: any;
      try {
        invoicesTable = getTable("invoices", computedCompany);
      } catch {
        invoicesTable = schema.invoices;
      }
      const client = (payload.buyerProfiles && payload.buyerProfiles[0]) || {};
      const rows = (await db
        .insert(invoicesTable)
        .values({
          invoiceNumber: payload.invoiceMeta?.invoiceNumber || invNum,
          quotationNumber: payload.invoiceMeta?.quotationNumber || null,
          clientName: String((client as any).name || payload.invoiceMeta?.clientName || "Client"),
          clientAddress: (client as any).address || payload.invoiceMeta?.clientAddress || null,
          clientEmail: (client as any).email || payload.invoiceMeta?.clientEmail || null,
          clientPhone: (client as any).phone || payload.invoiceMeta?.clientPhone || null,
          baseInvoiceId: null,
          pricingRuleSnapshot: null,
          companyProfileSnapshot: payload.invoiceMeta?.companyProfile || null,
          items: Array.isArray(itemsPayload) ? itemsPayload : [],
          subtotal: Number(payload.invoiceMeta?.subtotal || 0),
          taxTotal: Number(payload.invoiceMeta?.taxTotal || 0),
          total: Number(payload.invoiceMeta?.total || 0),
          currency: String(payload.invoiceMeta?.currency || "USD"),
          pdfPath: storagePath,
          status: "generated",
          createdBy: req.user?.id || null,
        })
        .returning()) as any[];
      const row = Array.isArray(rows) ? rows[0] : undefined;
      return res.json({ success: true, generatedFiles: [storagePath], generatedUrls, savedCount: row && row.id ? 1 : 0 });
    } catch (persistErr) {
      console.error("Persisting uploaded invoice failed:", persistErr);
      return res.json({ success: true, generatedFiles: [storagePath], generatedUrls, savedCount: 0, warn: "Uploaded but not saved to DB" });
    }
  } catch (error: any) {
    console.error("Invoice client upload error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
export async function streamInvoiceFileInline(req: Request, res: Response) {
  const name = String(req.params.filename || "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const baseDir = path.join(process.cwd(), "generated-invoices");
  const filePath = path.join(baseDir, name);
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
}

export async function streamInvoiceFileDownload(req: Request, res: Response) {
  const name = String(req.params.filename || "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const baseDir = path.join(process.cwd(), "generated-invoices");
  const filePath = path.join(baseDir, name);
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
}
