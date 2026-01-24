import { Response, Request, NextFunction } from "express";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, like, or, desc, inArray, and } from "drizzle-orm";
import { generateRequestNumber } from "../utils/requestNumber";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";

type MaterialRequestRow = typeof schema.materialRequests.$inferSelect;
type MaterialRequestDocumentRow = typeof schema.materialRequestDocuments.$inferSelect;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, ZIP"));
    }
  },
});

// Wrap multer middleware with error handling
export const uploadAttachmentMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("attachment")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large. Maximum file size is 10MB.",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            error: "Too many files. Please upload only one file at a time.",
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            error: "Unexpected file field. Please check the form field name.",
          });
        }
        return res.status(400).json({
          error: `File upload error: ${err.message}`,
        });
      }

      // Handle file filter errors
      if (err.message && err.message.includes("Invalid file type")) {
        return res.status(400).json({
          error: err.message,
        });
      }

      return next(err);
    }
    next();
  });
};

export const getMaterialRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);
    const company = req.user?.company;

    const materialRequestsTable = getTable("materialRequests", company);
    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    if (search) {
      const baseQuery = db
        .select()
        .from(materialRequestsTable)
        .where(
          or(
            like(materialRequestsTable.requestNumber, `%${search}%`),
            like(materialRequestsTable.project, `%${search}%`)
          )!
        )
        .orderBy(desc(materialRequestsTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const requests = (await qb) as MaterialRequestRow[];

      const requestIds = requests.map((r) => r.id);
      let documents: MaterialRequestDocumentRow[] = [];
      if (requestIds.length > 0) {
        documents = (await db
          .select()
          .from(materialRequestDocumentsTable)
          .where(inArray(materialRequestDocumentsTable.requestId, requestIds))) as MaterialRequestDocumentRow[];
      }

      const documentsByRequestId = documents.reduce(
        (acc, doc) => {
          (acc[doc.requestId] ||= []).push(doc);
          return acc;
        },
        {} as Record<string, MaterialRequestDocumentRow[]>
      );

      const requestsWithDocs = requests.map((request) => ({
        ...request,
        documents: documentsByRequestId[request.id] ?? [],
      }));

      return res.json({ requests: requestsWithDocs });
    }

    if (status) {
      const baseQuery = db
        .select()
        .from(materialRequestsTable)
        .where(eq(materialRequestsTable.status, status as any))
        .orderBy(desc(materialRequestsTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const requests = (await qb) as MaterialRequestRow[];

      const requestIds = requests.map((r) => r.id);
      let documents: MaterialRequestDocumentRow[] = [];
      if (requestIds.length > 0) {
        documents = (await db
          .select()
          .from(materialRequestDocumentsTable)
          .where(inArray(materialRequestDocumentsTable.requestId, requestIds))) as MaterialRequestDocumentRow[];
      }

      const documentsByRequestId = documents.reduce(
        (acc, doc) => {
          (acc[doc.requestId] ||= []).push(doc);
          return acc;
        },
        {} as Record<string, MaterialRequestDocumentRow[]>
      );

      const requestsWithDocs = requests.map((request) => ({
        ...request,
        documents: documentsByRequestId[request.id] ?? [],
      }));

      return res.json({ requests: requestsWithDocs });
    }

    const baseQuery = db
      .select()
      .from(materialRequestsTable)
      .orderBy(desc(materialRequestsTable.createdAt));
    let qb: any = baseQuery;
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const requests = (await qb) as MaterialRequestRow[];

    const requestIds = requests.map((r) => r.id);
    let documents: MaterialRequestDocumentRow[] = [];
    if (requestIds.length > 0) {
      documents = (await db
        .select()
        .from(materialRequestDocumentsTable)
        .where(inArray(materialRequestDocumentsTable.requestId, requestIds))) as MaterialRequestDocumentRow[];
    }

    const documentsByRequestId = documents.reduce(
      (acc, doc) => {
        (acc[doc.requestId] ||= []).push(doc);
        return acc;
      },
      {} as Record<string, MaterialRequestDocumentRow[]>
    );

    const requestsWithDocs = requests.map((request) => ({
      ...request,
      documents: documentsByRequestId[request.id] ?? [],
    }));

    res.json({ requests: requestsWithDocs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const materialRequestsTable = getTable("materialRequests", company);
    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    const requests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (requests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const documents = (await db
      .select()
      .from(materialRequestDocumentsTable)
      .where(eq(materialRequestDocumentsTable.requestId, id))) as MaterialRequestDocumentRow[];

    const requestWithDocs = {
      ...requests[0],
      documents,
    };

    res.json({ request: requestWithDocs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const company = req.user?.company;
    const requestNumber = await generateRequestNumber(company);
    const userId = req.user!.id;
    const materialRequestsTable = getTable("materialRequests", company);

    let attachmentPath: string | undefined;

    // Handle file upload if present
    if (req.file) {
      const filePath = generateFilePath(
        `material-request-${requestNumber}`,
        req.file.originalname,
        userId
      );

      const { path } = await uploadFile(
        STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
        filePath,
        req.file.buffer,
        req.file.mimetype
      );

      attachmentPath = path;
    }

    const requestData = {
      requestNumber,
      requestingEngineer: userId,
      items: JSON.stringify(req.body.items),
      attachmentPath,
      ...req.body,
    };

    const [newRequest] = (await db
      .insert(materialRequestsTable)
      .values(requestData)
      .returning()) as MaterialRequestRow[];

    await logActivity({
      userId,
      action: "create",
      entityType: "material_request",
      entityId: newRequest.id,
      description: `Created material request: ${requestNumber}`,
      newValue: requestData,
      req: req as any,
    });

    res.status(201).json({ request: newRequest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const existingRequests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (existingRequests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const oldValue = existingRequests[0];
    const updateData: any = { ...req.body, updatedAt: new Date() };

    if (req.body.items) {
      updateData.items = JSON.stringify(req.body.items);
    }

    const [updatedRequest] = (await db
      .update(materialRequestsTable)
      .set(updateData)
      .where(eq(materialRequestsTable.id, id))
      .returning()) as MaterialRequestRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "material_request",
      entityId: id,
      description: `Updated material request: ${updatedRequest.requestNumber}`,
      previousValue: oldValue,
      newValue: updatedRequest,
      req: req as any,
    });

    res.json({ request: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const approveMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const existingRequests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (existingRequests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const status = req.body.action === "reject" ? "rejected" : "approved";

    const updateData: any = {
      status: status as any,
      approvedBy: req.user!.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    };

    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const [updatedRequest] = (await db
      .update(materialRequestsTable)
      .set(updateData)
      .where(eq(materialRequestsTable.id, id))
      .returning()) as MaterialRequestRow[];

    await logActivity({
      userId: req.user!.id,
      action: status,
      entityType: "material_request",
      entityId: id,
      description: `${status === "approved" ? "Approved" : "Rejected"} material request: ${updatedRequest.requestNumber}`,
      newValue: updatedRequest,
      req: req as any,
    });

    res.json({ request: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const existingRequests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (existingRequests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const updateData: any = {
      status: "rejected",
      approvedBy: req.user!.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
      rejectionReason: rejectionReason || null,
    };

    const [updatedRequest] = (await db
      .update(materialRequestsTable)
      .set(updateData)
      .where(eq(materialRequestsTable.id, id))
      .returning()) as MaterialRequestRow[];

    await logActivity({
      userId: req.user!.id,
      action: "reject",
      entityType: "material_request",
      entityId: id,
      description: `Rejected material request: ${updatedRequest.requestNumber}`,
      newValue: updatedRequest,
      req: req as any,
    });

    res.json({ request: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const existingRequests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (existingRequests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const request = existingRequests[0];

    // Delete attachment from Supabase Storage if exists
    if (request.attachmentPath) {
      try {
        await deleteFile(
          STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
          request.attachmentPath
        );
      } catch (error) {
        console.error("Error deleting attachment:", error);
        // Continue with request deletion even if file deletion fails
      }
    }

    await db.delete(materialRequestsTable).where(eq(materialRequestsTable.id, id));

    await logActivity({
      userId,
      action: "delete",
      entityType: "material_request",
      entityId: id,
      description: `Deleted material request: ${request.requestNumber}`,
      previousValue: request,
      req: req as any,
    });

    res.json({ message: "Material request deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Download material request attachment
 */
export const downloadMaterialRequestAttachment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const requests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (requests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const request = requests[0];

    if (!request.attachmentPath) {
      return res.status(404).json({ error: "No attachment found for this request" });
    }

    const fileBuffer = await downloadFile(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      request.attachmentPath
    );

    // Extract filename from path or use default
    const fileName = request.attachmentPath.split("/").pop() || "attachment";

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.send(fileBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get signed URL for material request attachment
 */
export const getMaterialRequestAttachmentUrl = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const expiresIn = req.query.expiresIn
      ? parseInt(req.query.expiresIn as string)
      : 3600;
    const company = req.user?.company;
    const materialRequestsTable = getTable("materialRequests", company);

    const requests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, id))
      .limit(1)) as MaterialRequestRow[];

    if (requests.length === 0) {
      return res.status(404).json({ error: "Material request not found" });
    }

    const request = requests[0];

    if (!request.attachmentPath) {
      return res.status(404).json({ error: "No attachment found for this request" });
    }

    const signedUrl = await getSignedUrl(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      request.attachmentPath,
      expiresIn
    );

    res.json({
      url: signedUrl,
      expiresIn,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create material request with files atomically (multipart/form-data)
 */
export const createMaterialRequestWithFiles = async (req: AuthRequest, res: Response) => {
  try {
    const company = req.user?.company;
    const requestNumber = await generateRequestNumber(company);
    const userId = req.user!.id;
    const materialRequestsTable = getTable("materialRequests", company);
    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    // Parse form data
    const items = req.body.items ? JSON.parse(req.body.items) : [];
    
    const requestData = {
      requestNumber,
      requestingEngineer: userId,
      department: req.body.department || null,
      project: req.body.project || null,
      items: JSON.stringify(items),
      justification: req.body.justification || null,
      urgencyLevel: req.body.urgencyLevel || "normal",
    };

    type MaterialRequestDocumentRow = typeof schema.materialRequestDocuments.$inferSelect;
    const uploadedDocs: (MaterialRequestDocumentRow & { url: string })[] = [];
    const [newRequest] = (await db.transaction(async (tx) => {
      const [created] = (await tx
        .insert(materialRequestsTable)
        .values(requestData)
        .returning()) as MaterialRequestRow[];

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          const filePath = generateFilePath(
            `request-${created.id}`,
            file.originalname,
            userId
          );

          const { path, url } = await uploadFile(
            STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
            filePath,
            file.buffer,
            file.mimetype
          );

          const [doc] = (await tx
            .insert(materialRequestDocumentsTable)
            .values({
              requestId: created.id,
              fileName: file.originalname,
              filePath: path,
              fileType: file.mimetype,
              uploadedBy: userId,
            })
            .returning()) as MaterialRequestDocumentRow[];

          uploadedDocs.push({ ...doc, url });
        }
      }

      return [created];
    })) as MaterialRequestRow[];

    await logActivity({
      userId,
      action: "create",
      entityType: "material_request",
      entityId: newRequest.id,
      description: `Created material request: ${requestNumber} with ${uploadedDocs.length} documents`,
      newValue: { ...requestData, documents: uploadedDocs },
      req: req as any,
    });

    res.status(201).json({ 
      request: newRequest,
      documents: uploadedDocs 
    });
  } catch (error: any) {
    console.error("Error creating material request with files:", error);
    res.status(500).json({ error: error.message });
  }
};
