import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, like, or, desc } from "drizzle-orm";
import { generateQuotationNumber } from "../utils/quotationNumber";
import { logActivity } from "../utils/audit";
import { generateQuotationPDFNEW, generateQuotationPDFBuffer } from "../utils/pdfGenerator";
import { sendEmail } from "../utils/email";

type QuotationRow = typeof schema.quotations.$inferSelect;

export const getQuotations = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const quotationsTable = getTable("quotations", req.user?.company);

    let query = db.select().from(quotationsTable);

    if (search) {
      const baseQuery = db
        .select()
        .from(quotationsTable)
        .where(
          or(
            like(quotationsTable.quotationNumber, `%${search}%`),
            like(quotationsTable.clientName, `%${search}%`),
            like(quotationsTable.projectTitle, `%${search}%`)
          )!
        )
        .orderBy(desc(quotationsTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const quotations = (await qb) as QuotationRow[];
      return res.json({ quotations });
    }

    if (status) {
      const baseQuery = db
        .select()
        .from(quotationsTable)
        .where(eq(quotationsTable.status, status as any))
        .orderBy(desc(quotationsTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const quotations = (await qb) as QuotationRow[];
      return res.json({ quotations });
    }

    const baseQuery = db
      .select()
      .from(quotationsTable)
      .orderBy(desc(quotationsTable.createdAt));
    let qb: any = baseQuery;
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const quotations = (await qb) as QuotationRow[];

    res.json({ quotations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuotation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const quotationsTable = getTable("quotations", req.user?.company);

    const quotations = (await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id))
      .limit(1)) as QuotationRow[];

    if (quotations.length === 0) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    res.json({ quotation: quotations[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createQuotation = async (req: AuthRequest, res: Response) => {
  try {
    const quotationNumber = await generateQuotationNumber(req.user?.company);

    const {
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      projectTitle,
      projectReference,
      currency,
      lineItems,
      subtotal,
      nhilRate = 0,
      getfundRate = 0,
      vatRate = 0,
      vatAmount,
      total,
      paymentTerms,
      deliveryTerms,
      deliveryPeriod,
      validityPeriod,
      termsAndConditions,
      status,
    } = req.body;

    const quotationData: any = {
      clientName: String(clientName || ""),
      clientAddress: clientAddress ?? null,
      clientEmail: clientEmail ?? null,
      clientPhone: clientPhone ?? null,
      projectTitle: projectTitle ?? null,
      projectReference: projectReference ?? null,
      currency: currency ?? undefined,
      quotationNumber,
      preparedBy: req.user!.id,
      lineItems:
        typeof lineItems === "string"
          ? (() => {
              try {
                return JSON.parse(lineItems);
              } catch {
                return [];
              }
            })()
          : Array.isArray(lineItems)
          ? lineItems
          : [],
      subtotal: Number(subtotal),
      nhilRate: Number(nhilRate),
      getfundRate: Number(getfundRate),
      vatRate: Number(vatRate),
      vatAmount: Number(vatAmount),
      total: Number(total),
      paymentTerms: paymentTerms ?? null,
      deliveryTerms: deliveryTerms ?? null,
      deliveryPeriod: deliveryPeriod ?? null,
      validityPeriod: parseInt(String(validityPeriod)),
      termsAndConditions: termsAndConditions ?? null,
      status: status ?? undefined,
    };

    const userCheck = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user!.id))
      .limit(1);
    if (userCheck.length === 0) {
      return res.status(401).json({ error: "Invalid user: preparedBy not found" });
    }
    console.log(quotationData)

    const quotationsTable = getTable("quotations", req.user?.company);

    const [newQuotation] = (await db
      .insert(quotationsTable)
      .values(quotationData)
      .returning()) as QuotationRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "quotation",
      entityId: newQuotation.id,
      description: `Created quotation: ${quotationNumber}`,
      newValue: quotationData,
      req: req as any,
    });

    res.status(201).json({ quotation: newQuotation });
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ error: error.message });
  }
};

export const updateQuotation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const quotationsTable = getTable("quotations", req.user?.company);

    const existingQuotations = (await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id))
      .limit(1)) as QuotationRow[];

    if (existingQuotations.length === 0) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const oldValue = existingQuotations[0];

    const {
      currency,
      lineItems,
      subtotal,
      nhilRate = 0,
      getfundRate = 0,
      covidRate = 0,
      vatRate = 0,
      vatAmount,
      total,
      ...otherData
    } = req.body;
    console.log("Updating quotation with data:", req.body);

    const updateData: any = { ...otherData, updatedAt: new Date() };

    if (lineItems !== undefined) {
      updateData.lineItems =
        typeof lineItems === "string"
          ? (() => {
              try {
                return JSON.parse(lineItems);
              } catch {
                return [];
              }
            })()
          : Array.isArray(lineItems)
          ? lineItems
          : [];
    }

    if (subtotal !== undefined) {
      updateData.currency = currency;
      updateData.subtotal = Number(subtotal);
      updateData.nhilRate = Number(nhilRate);
      updateData.getfundRate = Number(getfundRate);
      updateData.covidRate = Number(covidRate);
      updateData.vatRate = Number(vatRate);
      updateData.vatAmount = Number(vatAmount);
      updateData.total = Number(total);
    }
    if (otherData.validityPeriod !== undefined) {
      updateData.validityPeriod = parseInt(String(otherData.validityPeriod)) || null;
    }

    const [updatedQuotation] = (await db
      .update(quotationsTable)
      .set(updateData)
      .where(eq(quotationsTable.id, id))
      .returning()) as QuotationRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "quotation",
      entityId: id,
      description: `Updated quotation: ${updatedQuotation.quotationNumber}`,
      previousValue: oldValue,
      newValue: updatedQuotation,
      req: req as any,
    });

    res.json({ quotation: updatedQuotation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuotation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const quotationsTable = getTable("quotations", req.user?.company);

    const existingQuotations = (await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id))
      .limit(1)) as QuotationRow[];

    if (existingQuotations.length === 0) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    await db.delete(quotationsTable).where(eq(quotationsTable.id, id));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "quotation",
      entityId: id,
      description: `Deleted quotation: ${existingQuotations[0].quotationNumber}`,
      previousValue: existingQuotations[0],
      req: req as any,
    });

    res.json({ message: "Quotation deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportQuotationPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inline = req.query.inline === "true"; // Check if we should show inline (for viewing) or download

    const quotationsTable = getTable("quotations", req.user?.company);

    const quotations = (await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id))
      .limit(1)) as QuotationRow[];

    if (quotations.length === 0) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const quotation = quotations[0];
    generateQuotationPDFNEW(quotation as any, res, inline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const emailQuotationPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientEmail, subject, body } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ error: "Recipient email is required" });
    }

    const quotationsTable = getTable("quotations", req.user?.company);

    const quotations = (await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id))
      .limit(1)) as QuotationRow[];

    if (quotations.length === 0) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const quotation = quotations[0];
    const pdfBuffer = await generateQuotationPDFBuffer(quotation as any);

    await sendEmail({
      to: recipientEmail,
      subject: subject || `Quotation: ${quotation.quotationNumber}`,
      html: body || `Please find attached the quotation ${quotation.quotationNumber}.`,
      attachments: [
        {
          filename: `Quotation_${quotation.quotationNumber}.pdf`,
          contentBase64: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ],
      from: req.user?.email, // Optional: send on behalf of the user if configured
    });

    await logActivity({
      userId: req.user!.id,
      action: "email",
      entityType: "quotation",
      entityId: id,
      description: `Emailed quotation ${quotation.quotationNumber} to ${recipientEmail}`,
      req: req as any,
    });

    res.json({ message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message });
  }
};
