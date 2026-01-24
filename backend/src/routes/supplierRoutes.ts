import { Router } from "express";
import * as supplierController from "../controllers/supplierController";
import * as supplierDocumentController from "../controllers/supplierDocumentController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Basic supplier routes
router.get("/", authenticate, supplierController.getSuppliers);
router.post("/", authenticate, authorize("admin", "procurement_officer"), supplierController.createSupplier);

// Atomic supplier creation with files (multipart/form-data)
router.post(
  "/with-files",
  authenticate,
  authorize("admin", "procurement_officer"),
  supplierDocumentController.uploadMultipleMiddleware,
  supplierController.createSupplierWithFiles
);

// Supplier document routes - specific paths before parameterized
router.post(
  "/:id/documents",
  authenticate,
  authorize("admin", "procurement_officer"),
  supplierDocumentController.uploadMiddleware,
  supplierDocumentController.uploadSupplierDocument
);

// Document-specific routes
router.get(
  "/documents/:id/download",
  authenticate,
  supplierDocumentController.downloadSupplierDocument
);
router.get(
  "/documents/:id/url",
  authenticate,
  supplierDocumentController.getSupplierDocumentUrl
);
router.delete(
  "/documents/:id",
  authenticate,
  authorize("admin", "procurement_officer"),
  supplierDocumentController.deleteSupplierDocument
);

// Supplier detail routes - must be LAST
router.get("/:id", authenticate, supplierController.getSupplier);
router.put("/:id", authenticate, authorize("admin", "procurement_officer"), supplierController.updateSupplier);
router.delete("/:id", authenticate, authorize("admin"), supplierController.deleteSupplier);

export default router;
