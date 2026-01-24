import { Response, Request, NextFunction } from "express";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { getTable } from "../utils/dbHelper";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";

type SupplierRow = typeof schema.suppliers.$inferSelect;
type SupplierDocumentRow = typeof schema.supplierDocuments.$inferSelect;

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

// Wrap multer middleware with error handling for single file upload
export const uploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("file")(req, res, (err) => {
    console.log("=== Multer Processing ===");
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
    console.log("=== Multer Processing (Multiple) ===");
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
 * Upload a document for a supplier
 */
export const uploadSupplierDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("=== Document Upload Request ===");
    console.log("File:", req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : "No file");
    console.log("Supplier ID:", req.params.id);
    console.log("User ID:", req.user?.id);

    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { id: supplierId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const suppliersTable = getTable("suppliers", company);
    const supplierDocumentsTable = getTable("supplierDocuments", company);

    // Verify supplier exists
    const suppliers = (await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, supplierId))
      .limit(1)) as SupplierRow[];

    if (suppliers.length === 0) {
      console.error(`Supplier not found: ${supplierId}`);
      return res.status(404).json({ error: "Supplier not found" });
    }

    console.log(`Uploading for supplier: ${suppliers[0].name}`);

    // Generate file path
    const filePath = generateFilePath(
      `supplier-${supplierId}`,
      req.file.originalname,
      userId
    );

    console.log("Generated file path:", filePath);

    // Upload to Supabase Storage
    const { path, url } = await uploadFile(
      STORAGE_BUCKETS.SUPPLIER_DOCUMENTS,
      filePath,
      req.file.buffer,
      req.file.mimetype
    );

    console.log("File uploaded successfully:", { path, url });

    // Save document metadata to database
    const [newDocument] = (await db
      .insert(supplierDocumentsTable)
      .values({
        supplierId,
        fileName: req.file.originalname,
        filePath: path, // Store Supabase path
        fileType: req.file.mimetype,
        uploadedBy: userId,
      })
      .returning()) as SupplierDocumentRow[];

    await logActivity({
      userId,
      action: "create",
      entityType: "supplier_document",
      entityId: newDocument.id,
      description: `Uploaded document for supplier: ${suppliers[0].name}`,
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
 * Download a supplier document
 */
export const downloadSupplierDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;

    const company = req.user?.company;
    const supplierDocumentsTable = getTable("supplierDocuments", company);

    // Get document from database
    const documents = (await db
      .select()
      .from(supplierDocumentsTable)
      .where(eq(supplierDocumentsTable.id, documentId))
      .limit(1)) as SupplierDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Download from Supabase Storage
    const fileBuffer = await downloadFile(
      STORAGE_BUCKETS.SUPPLIER_DOCUMENTS,
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
 * Get signed URL for a supplier document (for private access)
 */
export const getSupplierDocumentUrl = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;
    const expiresIn = req.query.expiresIn
      ? parseInt(req.query.expiresIn as string)
      : 3600; // Default 1 hour
    const company = req.user?.company;
    const supplierDocumentsTable = getTable("supplierDocuments", company);

    // Get document from database
    const documents = (await db
      .select()
      .from(supplierDocumentsTable)
      .where(eq(supplierDocumentsTable.id, documentId))
      .limit(1)) as SupplierDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Get signed URL from Supabase
    const signedUrl = await getSignedUrl(
      STORAGE_BUCKETS.SUPPLIER_DOCUMENTS,
      document.filePath,
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
 * Delete a supplier document
 */
export const deleteSupplierDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id: documentId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;
    const supplierDocumentsTable = getTable("supplierDocuments", company);

    // Get document from database
    const documents = (await db
      .select()
      .from(supplierDocumentsTable)
      .where(eq(supplierDocumentsTable.id, documentId))
      .limit(1)) as SupplierDocumentRow[];

    if (documents.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documents[0];

    // Delete from Supabase Storage
    await deleteFile(
      STORAGE_BUCKETS.SUPPLIER_DOCUMENTS,
      document.filePath
    );

    // Delete from database
    await db
      .delete(supplierDocumentsTable)
      .where(eq(supplierDocumentsTable.id, documentId));

    await logActivity({
      userId,
      action: "delete",
      entityType: "supplier_document",
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
