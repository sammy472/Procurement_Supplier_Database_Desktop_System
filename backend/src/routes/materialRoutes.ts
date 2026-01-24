import { Router } from "express";
import * as materialController from "../controllers/materialController";
import * as materialDocumentController from "../controllers/materialDocumentController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Atomic material creation with files (multipart/form-data)
router.post(
  "/with-files",
  authenticate,
  authorize("admin", "procurement_officer"),
  materialDocumentController.uploadMultipleMiddleware,
  materialController.createMaterialWithFiles
);

// Material document routes
router.post(
  "/:id/documents",
  authenticate,
  authorize("admin", "procurement_officer"),
  materialDocumentController.uploadMiddleware,
  materialDocumentController.uploadMaterialDocument
);
router.get(
  "/:id/documents",
  authenticate,
  materialDocumentController.getMaterialDocuments
);
router.get(
  "/documents/:id/download",
  authenticate,
  materialDocumentController.downloadMaterialDocument
);
router.get(
  "/documents/:id/url",
  authenticate,
  materialDocumentController.getMaterialDocumentUrl
);
router.delete(
  "/documents/:id",
  authenticate,
  authorize("admin", "procurement_officer"),
  materialDocumentController.deleteMaterialDocument
);

// Material routes - must be LAST
router.get("/", authenticate, materialController.getMaterials);
router.post("/", authenticate, authorize("admin", "procurement_officer"), materialController.createMaterial);
router.get("/:id", authenticate, materialController.getMaterial);
router.put("/:id", authenticate, authorize("admin", "procurement_officer"), materialController.updateMaterial);
router.delete("/:id", authenticate, authorize("admin"), materialController.deleteMaterial);
router.post("/:id/price-history", authenticate, authorize("admin", "procurement_officer"), materialController.addPriceHistory);

export default router;
