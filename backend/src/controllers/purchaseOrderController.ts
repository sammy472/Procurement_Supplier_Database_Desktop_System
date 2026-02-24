import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, like, desc, and } from "drizzle-orm";
import { generatePONumber } from "../utils/poNumber";
import { logActivity } from "../utils/audit";
import { generatePurchaseOrderPDFNEW, generatePurchaseOrderPDFBuffer } from "../utils/pdfGenerator";
import { sendEmail } from "../utils/email";

type PurchaseOrderRow = typeof schema.purchaseOrders.$inferSelect;
type SupplierRow = typeof schema.suppliers.$inferSelect;

export const getPurchaseOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);
    const suppliersTable = getTable("suppliers", req.user?.company);

    let qb: any = db
      .select({
        purchaseOrder: purchaseOrdersTable,
        supplier: {
          id: suppliersTable.id,
          name: suppliersTable.name,
          email: suppliersTable.email,
        },
      })
      .from(purchaseOrdersTable)
      .leftJoin(
        suppliersTable,
        eq(purchaseOrdersTable.supplierId, suppliersTable.id)
      );

    const conditions = [];

    if (search) {
      conditions.push(
        like(purchaseOrdersTable.poNumber, `%${search}%`)
      );
    }

    if (status) {
      conditions.push(eq(purchaseOrdersTable.status, status as any));
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }
    qb = qb.orderBy(desc(purchaseOrdersTable.createdAt));
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const purchaseOrdersWithSuppliers = (await qb) as {
      purchaseOrder: PurchaseOrderRow;
      supplier: { id: string; name: string; email: string } | null;
    }[];

    // Map results to include supplier name
    const purchaseOrders = purchaseOrdersWithSuppliers.map((row: any) => ({
      ...row.purchaseOrder,
      supplier: row.supplier || null,
      supplierName: row.supplier?.name || null,
    }));

    res.json({ purchaseOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);

    const purchaseOrders = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .limit(1)) as PurchaseOrderRow[];

    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    res.json({ purchaseOrder: purchaseOrders[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const poNumber = await generatePONumber(req.user?.company);

    const {
      lineItems,
      subtotal,
      discount = 0,
      vatRate = 0,
      currency = "GHC",
      ...otherData
    } = req.body;

    const vatAmount = ((subtotal) - (discount)) * ((vatRate) / 100);
    const total = subtotal - discount + vatAmount;

    const poData: any = {
      poNumber,
      createdBy: req.user!.id,
      lineItems: JSON.stringify(lineItems),
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      vatRate: vatRate.toString(),
      vatAmount: vatAmount.toString(),
      total: total.toString(),
      currency,
      ...otherData,
    };
    if (otherData?.expectedDeliveryDate) {
      poData.expectedDeliveryDate = new Date(otherData.expectedDeliveryDate);
    }
    console.log("Creating Purchase Order with data:", poData);

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);

    const [newPO] = (await db
      .insert(purchaseOrdersTable)
      .values(poData)
      .returning()) as PurchaseOrderRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "purchase_order",
      entityId: newPO.id,
      description: `Created purchase order: ${poNumber}`,
      newValue: poData,
      req: req as any,
    });

    res.status(201).json({ purchaseOrder: newPO });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);

    const existingPOs = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .limit(1)) as PurchaseOrderRow[];

    if (existingPOs.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const oldValue = existingPOs[0];

    const {
      lineItems,
      subtotal,
      discount = 0,
      vatRate = 0,
      currency,
      ...otherData
    } = req.body;

    const updateData: any = { ...otherData, updatedAt: new Date() };
    if (otherData?.expectedDeliveryDate) {
      updateData.expectedDeliveryDate = new Date(otherData.expectedDeliveryDate);
    }

    if (currency) {
      updateData.currency = currency;
    }

    if (lineItems !== undefined) {
      updateData.lineItems = JSON.stringify(lineItems);
    }

    if (subtotal !== undefined) {
      const calculatedVatAmount =
        (parseFloat(subtotal) - parseFloat(discount)) * (parseFloat(vatRate) / 100);
      const calculatedTotal = parseFloat(subtotal) - parseFloat(discount) + calculatedVatAmount;

      updateData.subtotal = subtotal.toString();
      updateData.discount = discount.toString();
      updateData.vatRate = vatRate.toString();
      updateData.vatAmount = calculatedVatAmount.toString();
      updateData.total = calculatedTotal.toString();
    }

    const [updatedPO] = (await db
      .update(purchaseOrdersTable)
      .set(updateData)
      .where(eq(purchaseOrdersTable.id, id))
      .returning()) as PurchaseOrderRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "purchase_order",
      entityId: id,
      description: `Updated purchase order: ${updatedPO.poNumber}`,
      previousValue: oldValue,
      newValue: updatedPO,
      req: req as any,
    });

    res.json({ purchaseOrder: updatedPO });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);

    const existingPOs = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .limit(1)) as PurchaseOrderRow[];

    if (existingPOs.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "purchase_order",
      entityId: id,
      description: `Deleted purchase order: ${existingPOs[0].poNumber}`,
      previousValue: existingPOs[0],
      req: req as any,
    });

    res.json({ message: "Purchase order deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportPurchaseOrderPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inline = req.query.inline === "true"; // Check if we should show inline (for viewing) or download

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);
    const suppliersTable = getTable("suppliers", req.user?.company);
    const quotationsTable = getTable("quotations", req.user?.company);

    const purchaseOrders = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .limit(1)) as PurchaseOrderRow[];

    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const po = purchaseOrders[0];

    // Get supplier details
    const suppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, po.supplierId))
      .limit(1)) as SupplierRow[];

    const supplier = suppliers[0];

    // Optionally get quotation to attach currency (if linked)
    let currency: string | undefined = (po as any).currency;
    if (!currency && po.quotationId) {
      const quotations = (await db
        .select({ currency: quotationsTable.currency })
        .from(quotationsTable)
        .where(eq(quotationsTable.id, po.quotationId))
        .limit(1)) as Array<{ currency: string }>;
      currency = quotations[0]?.currency;
    }

    const poWithSupplierAndCurrency = {
      ...po,
      supplierName: supplier.name,
      supplierAddress: supplier.address,
      supplierEmail: supplier.email,
      supplierPhone: supplier.phone,
      currency,
    };

    generatePurchaseOrderPDFNEW(poWithSupplierAndCurrency as any, req.user?.company, res, inline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const emailPurchaseOrderPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientEmail, subject, body } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ error: "Recipient email is required" });
    }

    const purchaseOrdersTable = getTable("purchaseOrders", req.user?.company);
    const suppliersTable = getTable("suppliers", req.user?.company);
    const quotationsTable = getTable("quotations", req.user?.company);

    const purchaseOrders = (await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, id))
      .limit(1)) as PurchaseOrderRow[];

    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const po = purchaseOrders[0];

    const suppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, po.supplierId))
      .limit(1)) as SupplierRow[];
    const supplier = suppliers[0];

    let currency: string | undefined = (po as any).currency;
    if (!currency && po.quotationId) {
      const quotations = (await db
        .select({ currency: quotationsTable.currency })
        .from(quotationsTable)
        .where(eq(quotationsTable.id, po.quotationId))
        .limit(1)) as Array<{ currency: string }>;
      currency = quotations[0]?.currency;
    }

    const poData = {
      ...po,
      supplierName: supplier?.name || "",
      supplierAddress: supplier?.address || "",
      supplierEmail: supplier?.email || "",
      supplierPhone: supplier?.phone || "",
      currency,
    };

    const pdfBuffer = await generatePurchaseOrderPDFBuffer(poData as any, req.user?.company);

    await sendEmail({
      to: recipientEmail,
      subject: subject || `Purchase Order: ${po.poNumber}`,
      html: body || `Please find attached the purchase order ${po.poNumber}.`,
      attachments: [
        {
          filename: `Purchase_Order_${po.poNumber}.pdf`,
          contentBase64: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ],
      from: req.user?.email,
    });

    await logActivity({
      userId: req.user!.id,
      action: "email",
      entityType: "purchase_order",
      entityId: id,
      description: `Emailed purchase order ${po.poNumber} to ${recipientEmail}`,
      req: req as any,
    });

    res.json({ message: "Email sent successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
