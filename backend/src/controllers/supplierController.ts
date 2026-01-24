import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, like, or, and } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";
import { getTable } from "../utils/dbHelper";

type SupplierRow = typeof schema.suppliers.$inferSelect;
type SupplierDocumentRow = typeof schema.supplierDocuments.$inferSelect;

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, isActive } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const suppliersTable = getTable("suppliers", req.user?.company);
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(suppliersTable.name, `%${search}%`),
          like(suppliersTable.email, `%${search}%`),
          like(suppliersTable.contactPerson, `%${search}%`)
        )!
      );
    }

    if (category) {
      conditions.push(eq(suppliersTable.category, category as string));
    }

    if (isActive !== undefined) {
      conditions.push(eq(suppliersTable.isActive, isActive === "true"));
    }

    let qb: any = db.select().from(suppliersTable);
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }
    qb = qb.orderBy(suppliersTable.createdAt);
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const suppliers = (await qb) as SupplierRow[];

    res.json({ suppliers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const suppliersTable = getTable("suppliers", req.user?.company);
    const supplierDocumentsTable = getTable("supplierDocuments", req.user?.company);

    const suppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .limit(1)) as SupplierRow[];

    if (suppliers.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Get documents
    const documents = (await db
      .select()
      .from(supplierDocumentsTable)
      .where(eq(supplierDocumentsTable.supplierId, id))) as SupplierDocumentRow[];

    res.json({ supplier: { ...suppliers[0], documents } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const suppliersTable = getTable("suppliers", req.user?.company);
    
    const supplierData = {
      ...req.body,
      createdBy: req.user!.id,
    };

    const [newSupplier] = (await db
      .insert(suppliersTable)
      .values(supplierData)
      .returning()) as SupplierRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "supplier",
      entityId: newSupplier.id,
      description: `Created supplier: ${newSupplier.name}`,
      newValue: supplierData,
      req: req as any,
    });

    res.status(201).json({ supplier: newSupplier });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const suppliersTable = getTable("suppliers", req.user?.company);

    const existingSuppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .limit(1)) as SupplierRow[];

    if (existingSuppliers.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const oldValue = existingSuppliers[0];

    const [updatedSupplier] = (await db
      .update(suppliersTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(suppliersTable.id, id))
      .returning()) as SupplierRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "supplier",
      entityId: id,
      description: `Updated supplier: ${updatedSupplier.name}`,
      previousValue: oldValue,
      newValue: updatedSupplier,
      req: req as any,
    });

    res.json({ supplier: updatedSupplier });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const suppliersTable = getTable("suppliers", req.user?.company);

    const existingSuppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .limit(1)) as SupplierRow[];

    if (existingSuppliers.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Soft delete
    const [deletedSupplier] = (await db
      .update(suppliersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(suppliersTable.id, id))
      .returning()) as SupplierRow[];

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "supplier",
      entityId: id,
      description: `Deleted supplier: ${deletedSupplier.name}`,
      previousValue: existingSuppliers[0],
      req: req as any,
    });

    res.json({ message: "Supplier deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create supplier with files atomically (multipart/form-data)
 */
export const createSupplierWithFiles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const suppliersTable = getTable("suppliers", req.user?.company);
    const supplierDocumentsTable = getTable("supplierDocuments", req.user?.company);
    
    // Parse JSON data from form field
    const supplierData = {
      name: req.body.name,
      category: req.body.category || null,
      address: req.body.address || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      country: req.body.country || null,
      contactPerson: req.body.contactPerson || null,
      reliabilityRating: req.body.reliabilityRating ? parseInt(req.body.reliabilityRating) : 3,
      notes: req.body.notes || null,
      isActive: req.body.isActive === "true" || req.body.isActive === true,
      createdBy: userId,
    };

    // Note: Type inference for documents might be tricky with dynamic tables
    const uploadedDocs: any[] = [];
    const [newSupplier] = (await db.transaction(async (tx) => {
      const [created] = (await tx
        .insert(suppliersTable)
        .values(supplierData)
        .returning()) as SupplierRow[];

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          const filePath = generateFilePath(
            `supplier-${created.id}`,
            file.originalname,
            userId
          );

          const { path, url } = await uploadFile(
            STORAGE_BUCKETS.SUPPLIER_DOCUMENTS,
            filePath,
            file.buffer,
            file.mimetype
          );

          const [doc] = (await tx
            .insert(supplierDocumentsTable)
            .values({
              supplierId: created.id,
              fileName: file.originalname,
              filePath: path,
              fileType: file.mimetype,
              uploadedBy: userId,
            })
            .returning()) as SupplierDocumentRow[];

          uploadedDocs.push({ ...doc, url });
        }
      }

      return [created];
    })) as SupplierRow[];

    await logActivity({
      userId,
      action: "create",
      entityType: "supplier",
      entityId: newSupplier.id,
      description: `Created supplier: ${newSupplier.name} with ${uploadedDocs.length} documents`,
      newValue: { ...supplierData, documents: uploadedDocs },
      req: req as any,
    });

    res.status(201).json({ 
      supplier: newSupplier,
      documents: uploadedDocs 
    });
  } catch (error: any) {
    console.error("Error creating supplier with files:", error);
    res.status(500).json({ error: error.message });
  }
};
