import { Response, Request, NextFunction } from "express";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import { getTable } from "../utils/dbHelper";
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";

type MaterialRow = typeof schema.materials.$inferSelect;
type MaterialDocumentRow = typeof schema.materialDocuments.$inferSelect;

// Configure multer for memory storage (we'll upload to Supabase, not local disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 3, // Maximum 3 files
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs and common document formats
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG are allowed."));
    }
  },
});

// Wrap multer middleware with error handling
export const uploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("document")(req, res, (err) => {
    console.log("=== Multer Processing (Material Document) ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("File received:", req.file ? { name: req.file.originalname, size: req.file.size } : "No file");
    console.log("Error:", err?.message || "No error");

    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large. Maximum file size is 10MB.",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            error: "Too many files. Maximum 3 files allowed.",
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

// Middleware for multiple file uploads (max 3)
export const uploadMultipleMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.array("files", 3)(req, res, (err) => {
    console.log("=== Multer Processing (Multiple Material Documents) ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Files received:", req.files ? (req.files as Express.Multer.File[]).length : 0);
    console.log("Error:", err?.message || "No error");

    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large. Maximum file size is 10MB per file.",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            error: "Too many files. Maximum 3 files allowed.",
          });
        }
        return res.status(400).json({
          error: `File upload error: ${err.message}`,
        });
      }

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

/**
 * Upload a document for a material
 */
export const uploadMaterialDocument = async (req: AuthRequest, res: Response) => {
  try {
    console.log("=== Material Document Upload Request ===");
    console.log("File:", req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : "No file");
    console.log("Material ID:", req.params.id);
    
    const { id: materialId } = req.params;
    const file = req.file;
    const company = req.user?.company;

    const materialsTable = getTable("materials", company);
    const materialDocumentsTable = getTable("materialDocuments", company);

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Verify material exists
    const material = (await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.id, materialId))
      .limit(1)) as MaterialRow[];

    if (material.length === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    // Generate file path
    const fileName = generateFilePath("material-documents", file.originalname, materialId);

    // Upload to Supabase
    const result = await uploadFile(
      STORAGE_BUCKETS.MATERIAL_DOCUMENTS,
      fileName,
      file.buffer,
      file.mimetype
    );


    // Save to database
    const document = (await db
      .insert(materialDocumentsTable)
      .values({
        materialId,
        fileName: file.originalname,
        filePath: fileName,
        fileType: file.mimetype,
        uploadedBy: req.user?.id,
      })
      .returning()) as MaterialDocumentRow[];

    // Log activity
    await logActivity({
      userId: req.user?.id!,
      action: "upload",
      entityType: "material_document",
      entityId: document[0].id,
      description: `Uploaded document "${file.originalname}" for material`,
    });

    res.status(201).json({
      document: {
        id: document[0].id,
        fileName: document[0].fileName,
        fileType: document[0].fileType,
        uploadedAt: document[0].uploadedAt,
      },
    });
  } catch (error: any) {
    console.error("Error uploading material document:", error);
    res.status(500).json({ error: error.message || "Failed to upload document" });
  }
};

/**
 * Download a material document
 */
export const downloadMaterialDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialDocumentsTable = getTable("materialDocuments", company);

    const documents = (await db
      .select()
      .from(materialDocumentsTable)
      .where(eq(materialDocumentsTable.id, documentId))
      .limit(1)) as MaterialDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];
    const fileBuffer = await downloadFile(STORAGE_BUCKETS.MATERIAL_DOCUMENTS, document.filePath);

    res.setHeader("Content-Type", document.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
    res.send(fileBuffer);

    // Log activity
    await logActivity({
      userId: req.user?.id!,
      action: "download",
      entityType: "material_document",
      entityId: documentId,
      description: `Downloaded document "${document.fileName}"`,
    });
  } catch (error: any) {
    console.error("Error downloading material document:", error);
    res.status(500).json({ error: error.message || "Failed to download document" });
  }
};

/**
 * Get a signed URL for viewing a material document
 */
export const getMaterialDocumentUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialDocumentsTable = getTable("materialDocuments", company);

    const documents = (await db
      .select()
      .from(materialDocumentsTable)
      .where(eq(materialDocumentsTable.id, documentId))
      .limit(1)) as MaterialDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];
    
    // Get signed URL from Supabase
    const signedUrl = await getSignedUrl(
      STORAGE_BUCKETS.MATERIAL_DOCUMENTS,
      document.filePath,
      3600 * 24 * 7 // 7 days
    );

    res.json({ url: signedUrl });

    // Log activity
    await logActivity({
      userId: req.user?.id!,
      action: "view",
      entityType: "material_document",
      entityId: documentId,
      description: `Viewed document "${document.fileName}"`,
    });
  } catch (error: any) {
    console.error("Error getting material document URL:", error);
    res.status(500).json({ error: error.message || "Failed to get document URL" });
  }
};

/**
 * Delete a material document
 */
export const deleteMaterialDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialDocumentsTable = getTable("materialDocuments", company);

    const documents = await db
      .select()
      .from(materialDocumentsTable)
      .where(eq(materialDocumentsTable.id, documentId))
      .limit(1);

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Delete from Supabase storage
    await deleteFile(STORAGE_BUCKETS.MATERIAL_DOCUMENTS, document.filePath);

    // Delete from database
    await db
      .delete(materialDocumentsTable)
      .where(eq(materialDocumentsTable.id, documentId));

    // Log activity
    await logActivity({
      userId: req.user?.id!,
      action: "delete",
      entityType: "material_document",
      entityId: documentId,
      description: `Deleted document "${document.fileName}"`,
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting material document:", error);
    res.status(500).json({ error: error.message || "Failed to delete document" });
  }
};

/**
 * Get all documents for a material
 */
export const getMaterialDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { id: materialId } = req.params;
    const company = req.user?.company;

    const materialsTable = getTable("materials", company);
    const materialDocumentsTable = getTable("materialDocuments", company);

    // Verify material exists
    const material = (await db
      .select()
      .from(materialsTable)
      .where(eq(materialsTable.id, materialId))
      .limit(1)) as MaterialRow[];

    if (material.length === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    const documents = (await db
      .select()
      .from(materialDocumentsTable)
      .where(eq(materialDocumentsTable.materialId, materialId))) as MaterialDocumentRow[];

    res.json({ documents });
  } catch (error: any) {
    console.error("Error fetching material documents:", error);
    res.status(500).json({ error: error.message || "Failed to fetch documents" });
  }
};
