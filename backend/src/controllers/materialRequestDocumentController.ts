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

type MaterialRequestRow = typeof schema.materialRequests.$inferSelect;
type MaterialRequestDocumentRow = typeof schema.materialRequestDocuments.$inferSelect;

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
  upload.single("file")(req, res, (err) => {
    console.log("=== Multer Processing (Material Request) ===");
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
    console.log("=== Multer Processing (Multiple Material Request Documents) ===");
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
 * Upload a document for a material request
 */
export const uploadMaterialRequestDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("=== Document Upload Request (Material Request) ===");
    console.log("File:", req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : "No file");
    console.log("Request ID:", req.params.id);
    console.log("User ID:", req.user?.id);

    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { id: requestId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const materialRequestsTable = getTable("materialRequests", company);
    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    // Verify material request exists
    const requests = (await db
      .select()
      .from(materialRequestsTable)
      .where(eq(materialRequestsTable.id, requestId))
      .limit(1)) as MaterialRequestRow[];

    if (requests.length === 0) {
      console.error(`Material request not found: ${requestId}`);
      return res.status(404).json({ error: "Material request not found" });
    }

    console.log(`Uploading for material request: ${requests[0].requestNumber}`);

    // Generate file path
    const filePath = generateFilePath(
      `request-${requestId}`,
      req.file.originalname,
      userId
    );

    console.log("Generated file path:", filePath);

    // Upload to Supabase Storage
    const { path, url } = await uploadFile(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      filePath,
      req.file.buffer,
      req.file.mimetype
    );

    console.log("File uploaded successfully:", { path, url });

    // Save document metadata to database
    const [newDocument] = (await db
      .insert(materialRequestDocumentsTable)
      .values({
        requestId,
        fileName: req.file.originalname,
        filePath: path, // Store Supabase path
        fileType: req.file.mimetype,
        uploadedBy: userId,
      })
      .returning()) as MaterialRequestDocumentRow[];

    await logActivity({
      userId,
      action: "create",
      entityType: "material_request_document",
      entityId: newDocument.id,
      description: `Uploaded document for material request: ${requests[0].requestNumber}`,
      newValue: newDocument,
      req: req as any,
    });

    console.log("Document saved to database:", newDocument.id);

    res.status(201).json({
      document: {
        ...newDocument,
        url, // Include public URL
      },
    });
  } catch (error: any) {
    console.error("Document upload error:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Download a material request document
 */
export const downloadMaterialRequestDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    // Get document from database
    const documents = (await db
      .select()
      .from(materialRequestDocumentsTable)
      .where(eq(materialRequestDocumentsTable.id, documentId))
      .limit(1)) as MaterialRequestDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Download from Supabase Storage
    const fileBuffer = await downloadFile(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      document.filePath
    );

    // Set headers for file download
    res.setHeader("Content-Type", document.fileType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName}"`
    );

    res.send(fileBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a signed URL for a material request document
 */
export const getMaterialRequestDocumentUrl = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    // Get document from database
    const documents = await db
      .select()
      .from(materialRequestDocumentsTable)
      .where(eq(materialRequestDocumentsTable.id, documentId))
      .limit(1);

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Get signed URL
    const signedUrl = await getSignedUrl(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      document.filePath,
      3600
    );

    res.json({ url: signedUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a material request document
 */
export const deleteMaterialRequestDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;
    const company = req.user?.company;

    const materialRequestDocumentsTable = getTable("materialRequestDocuments", company);

    // Get document from database
    const documents = await db
      .select()
      .from(materialRequestDocumentsTable)
      .where(eq(materialRequestDocumentsTable.id, documentId))
      .limit(1);

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Delete from Supabase Storage
    await deleteFile(
      STORAGE_BUCKETS.MATERIAL_REQUEST_ATTACHMENTS,
      document.filePath
    );

    // Delete from database
    await db
      .delete(materialRequestDocumentsTable)
      .where(eq(materialRequestDocumentsTable.id, documentId));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "material_request_document",
      entityId: documentId,
      description: `Deleted document: ${document.fileName}`,
      previousValue: document,
      req: req as any,
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
