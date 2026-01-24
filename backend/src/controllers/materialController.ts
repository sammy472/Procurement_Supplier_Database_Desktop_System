import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, like, or, and, desc, inArray } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";
import { getTable } from "../utils/dbHelper";

type MaterialRow = typeof schema.materials.$inferSelect;
type PriceHistoryRow = typeof schema.priceHistory.$inferSelect;
type MaterialDocumentRow = typeof schema.materialDocuments.$inferSelect;
//type SupplierRow = typeof schema.suppliers.$inferSelect;
type MaterialSupplierRow = typeof schema.materialSuppliers.$inferSelect;

export const getMaterials = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, brand } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const materialsTable = getTable("materials", req.user?.company);
    const priceHistoryTable = getTable("priceHistory", req.user?.company);
    const suppliersTable = getTable("suppliers", req.user?.company);
    const materialDocumentsTable = getTable("materialDocuments", req.user?.company);

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(materialsTable.name, `%${search}%`),
          like(materialsTable.partNumber, `%${search}%`),
          like(materialsTable.description, `%${search}%`)
        )!
      );
    }

    if (category) {
      conditions.push(eq(materialsTable.category, category as string));
    }

    if (brand) {
      conditions.push(eq(materialsTable.brand, brand as string));
    }

    let qb: any = db.select().from(materialsTable);
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }
    qb = qb.orderBy(desc(materialsTable.createdAt));
    if (limitParam > 0) {
      qb = qb.limit(limitParam);
    }
    if (offsetParam > 0) {
      qb = qb.offset(offsetParam);
    }
    const materials = (await qb) as MaterialRow[];

    const materialIds = materials.map((m: MaterialRow) => m.id);

    // ---------- PRICE HISTORY ----------
    let priceHistories: PriceHistoryRow[] = [];
    if (materialIds.length > 0) {
      priceHistories = (await db
        .select()
        .from(priceHistoryTable)
        .where(inArray(priceHistoryTable.materialId, materialIds))) as PriceHistoryRow[];
    }

    const supplierIds = [
      ...new Set(priceHistories.map((ph) => ph.supplierId).filter(Boolean)),
    ];

    let suppliers: { id: string; name: string }[] = [];
    if (supplierIds.length > 0) {
      suppliers = (await db
        .select({
          id: suppliersTable.id,
          name: suppliersTable.name,
        })
        .from(suppliersTable)
        .where(inArray(suppliersTable.id, supplierIds))) as { id: string; name: string }[];
    }

    const supplierNameById = suppliers.reduce(
      (acc, supplier) => {
        acc[supplier.id] = supplier.name;
        return acc;
      },
      {} as Record<string, string>
    );

    const priceHistoryByMaterialId = priceHistories.reduce(
      (acc, ph: PriceHistoryRow) => {
        const { supplierId, ...rest } = ph;

        const enrichedPriceHistory = {
          ...rest,
          supplierName: supplierNameById[supplierId] ?? null,
        };

        (acc[ph.materialId] ||= []).push(enrichedPriceHistory);
        return acc;
      },
      {} as Record<string, any[]>
    );

    // ---------- NEW: MATERIAL DOCUMENTS ----------

    let materialDocuments: MaterialDocumentRow[] = [];
    if (materialIds.length > 0) {
      materialDocuments = (await db
        .select()
        .from(materialDocumentsTable)
        .where(inArray(materialDocumentsTable.materialId, materialIds))) as MaterialDocumentRow[];
    }

    const documentsByMaterialId = materialDocuments.reduce(
      (acc, doc: MaterialDocumentRow) => {
        (acc[doc.materialId] ||= []).push(doc);
        return acc;
      },
      {} as Record<string, any[]>
    );

    // ---------- FINAL MATERIAL SHAPE ----------

    const materialsWithRelations = materials.map((material: MaterialRow) => ({
      ...material,
      priceHistory: priceHistoryByMaterialId[material.id] ?? [],
      documents: documentsByMaterialId[material.id] ?? [],
    }));

    res.json({ materials: materialsWithRelations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const getMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const materialsTable = getTable("materials", req.user?.company);
    const materialSuppliersTable = getTable("materialSuppliers", req.user?.company);
    const priceHistoryTable = getTable("priceHistory", req.user?.company);
    const suppliersTable = getTable("suppliers", req.user?.company);

    const materials = (await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.id, id))
      .limit(1)) as MaterialRow[];

    if (materials.length === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    // Get linked suppliers
    const materialSuppliers = (await db
      .select()
      .from(materialSuppliersTable)
      .where(eq(materialSuppliersTable.materialId, id))) as MaterialSupplierRow[];

    // Get price history
    const rawPriceHistory = await db
      .select()
      .from(priceHistoryTable)
      .where(eq(priceHistoryTable.materialId, id))
      .orderBy(desc(priceHistoryTable.dateQuoted || priceHistoryTable.createdAt));


    const supplierIds = [
      ...new Set(rawPriceHistory.map((ph) => ph.supplierId).filter(Boolean)),
    ];

    let suppliers: { id: string; name: string }[] = [];
    if (supplierIds.length > 0) {
      suppliers = (await db
        .select({
          id: suppliersTable.id,
          name: suppliersTable.name,
        })
        .from(suppliersTable)
        .where(inArray(suppliersTable.id, supplierIds))) as { id: string; name: string }[];
    }

    const supplierNameById = suppliers.reduce(
      (acc, supplier) => {
        acc[supplier.id] = supplier.name;
        return acc;
      },
      {} as Record<string, string>
    );

    const priceHistory = rawPriceHistory.map(({ supplierId, ...rest }) => ({
      ...rest,
      supplierName: supplierNameById[supplierId] ?? null,
    }));


    let cheapestSupplier = null;
    if (rawPriceHistory.length > 0) {
      const supplierPrices = new Map();

      for (const price of rawPriceHistory) {
        const existing = supplierPrices.get(price.supplierId);
        const priceDate = new Date(price.dateQuoted || price.createdAt);

        if (
          !existing ||
          priceDate >
            new Date(existing.dateQuoted || existing.createdAt)
        ) {
          supplierPrices.set(price.supplierId, price);
        }
      }

      let lowestPrice = null;
      for (const price of supplierPrices.values()) {
        const unitPrice = parseFloat(price.unitPrice);
        if (
          lowestPrice === null ||
          unitPrice < parseFloat(lowestPrice.unitPrice)
        ) {
          lowestPrice = price;
        }
      }

      if (lowestPrice) {
        const suppliers = await db
          .select()
          .from(suppliersTable)
          .where(eq(suppliersTable.id, lowestPrice.supplierId))
          .limit(1);

        if (suppliers.length > 0) {
          cheapestSupplier = {
            ...suppliers[0],
            unitPrice: lowestPrice.unitPrice,
            leadTime: lowestPrice.leadTime,
            availabilityStatus: lowestPrice.availabilityStatus,
          };
        }
      }
    }

    res.json({
      material: {
        ...materials[0],
        linkedSuppliers: materialSuppliers,
        priceHistory,
        cheapestSupplier,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const createMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const materialsTable = getTable("materials", req.user?.company);
    const materialSuppliersTable = getTable("materialSuppliers", req.user?.company);

    const materialData = {
      ...req.body,
      createdBy: req.user!.id,
    };

    const [newMaterial] = (await db
      .insert(materialsTable)
      .values(materialData)
      .returning()) as MaterialRow[];

    // Link suppliers if provided
    if (req.body.supplierIds && Array.isArray(req.body.supplierIds)) {
      const links = req.body.supplierIds.map((supplierId: string) => ({
        materialId: newMaterial.id,
        supplierId,
      }));

      await db.insert(materialSuppliersTable).values(links);
    }

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "material",
      entityId: newMaterial.id,
      description: `Created material: ${newMaterial.name}`,
      newValue: materialData,
      req: req as any,
    });

    res.status(201).json({ material: newMaterial });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const materialsTable = getTable("materials", req.user?.company);
    const materialSuppliersTable = getTable("materialSuppliers", req.user?.company);

    const existingMaterials = await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.id, id))
      .limit(1);

    if (existingMaterials.length === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    const oldValue = existingMaterials[0];
    const { supplierIds, ...updateData } = req.body;

    const [updatedMaterial] = (await db
      .update(materialsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(materialsTable.id, id))
      .returning()) as MaterialRow[];

    // Update supplier links if provided
    if (supplierIds && Array.isArray(supplierIds)) {
      await db
        .delete(materialSuppliersTable)
        .where(eq(materialSuppliersTable.materialId, id));

      const links = supplierIds.map((supplierId: string) => ({
        materialId: id,
        supplierId,
      }));

      await db.insert(materialSuppliersTable).values(links);
    }

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "material",
      entityId: id,
      description: `Updated material: ${updatedMaterial.name}`,
      previousValue: oldValue,
      newValue: updatedMaterial,
      req: req as any,
    });

    res.json({ material: updatedMaterial });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const materialsTable = getTable("materials", req.user?.company);

    const existingMaterials = await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.id, id))
      .limit(1);

    if (existingMaterials.length === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    await db.delete(materialsTable).where(eq(materialsTable.id, id));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "material",
      entityId: id,
      description: `Deleted material: ${existingMaterials[0].name}`,
      previousValue: existingMaterials[0],
      req: req as any,
    });

    res.json({ message: "Material deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addPriceHistory = async (req: AuthRequest, res: Response) => {
  try {
    const priceHistoryTable = getTable("priceHistory", req.user?.company);
    
    const priceData = {
      ...req.body,
      createdBy: req.user!.id,
    };

    const [newPrice] = (await db
      .insert(priceHistoryTable)
      .values(priceData)
      .returning()) as PriceHistoryRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "price_history",
      entityId: newPrice.id,
      description: `Added price history for material`,
      newValue: priceData,
      req: req as any,
    });

    res.status(201).json({ priceHistory: newPrice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create material with files atomically (multipart/form-data)
 */
export const createMaterialWithFiles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const materialsTable = getTable("materials", req.user?.company);
    const materialSuppliersTable = getTable("materialSuppliers", req.user?.company);
    const materialDocumentsTable = getTable("materialDocuments", req.user?.company);
    
    // Parse form data
    const materialData = {
      name: req.body.name,
      description: req.body.description || null,
      technicalSpec: req.body.technicalSpec || null,
      category: req.body.category || null,
      partNumber: req.body.partNumber || null,
      unitOfMeasure: req.body.unitOfMeasure || null,
      brand: req.body.brand || null,
      manufacturer: req.body.manufacturer || null,
      defaultSupplierId: req.body.defaultSupplierId || null,
      minimumStockLevel: req.body.minimumStockLevel ? parseInt(req.body.minimumStockLevel) : 0,
      createdBy: userId,
    };

    // Create material first
    const [newMaterial] = await db
      .insert(materialsTable)
      .values(materialData)
      .returning() as MaterialRow[];

    // Link suppliers if provided
    if (req.body.supplierIds) {
      const supplierIds = Array.isArray(req.body.supplierIds) 
        ? req.body.supplierIds 
        : JSON.parse(req.body.supplierIds);
      
      if (supplierIds.length > 0) {
        const links = supplierIds.map((supplierId: string) => ({
          materialId: newMaterial.id,
          supplierId,
        }));
        await db.insert(materialSuppliersTable).values(links);
      }
    }

    // Upload files if present
    const uploadedDocs: any[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = generateFilePath(
          "material-documents",
          file.originalname,
          newMaterial.id
        );

        await uploadFile(
          STORAGE_BUCKETS.MATERIAL_DOCUMENTS,
          fileName,
          file.buffer,
          file.mimetype
        );

        const [doc] = (await db
          .insert(materialDocumentsTable)
          .values({
            materialId: newMaterial.id,
            fileName: file.originalname,
            filePath: fileName,
            fileType: file.mimetype,
            uploadedBy: userId,
          })
          .returning()) as MaterialDocumentRow[];

        uploadedDocs.push(doc);
      }
    }

    await logActivity({
      userId,
      action: "create",
      entityType: "material",
      entityId: newMaterial.id,
      description: `Created material: ${newMaterial.name} with ${uploadedDocs.length} documents`,
      newValue: { ...materialData, documents: uploadedDocs },
      req: req as any,
    });

    res.status(201).json({ 
      material: newMaterial,
      documents: uploadedDocs 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
