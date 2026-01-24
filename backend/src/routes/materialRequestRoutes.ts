import { Router } from "express";
import * as requestController from "../controllers/materialRequestController";
import * as documentController from "../controllers/materialRequestDocumentController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, requestController.getMaterialRequests);
router.get("/:id", authenticate, requestController.getMaterialRequest);

// Atomic material request creation with files (multipart/form-data)
router.post(
  "/with-files",
  authenticate,
  documentController.uploadMultipleMiddleware,
  requestController.createMaterialRequestWithFiles
);

router.post(
  "/",
  authenticate,
  requestController.uploadAttachmentMiddleware,
  requestController.createMaterialRequest
);
router.put("/:id", authenticate, requestController.updateMaterialRequest);
router.put("/:id/approve", authenticate, authorize("admin", "procurement_officer"), requestController.approveMaterialRequest);
router.put("/:id/reject", authenticate, authorize("admin", "procurement_officer"), requestController.rejectMaterialRequest);
router.delete("/:id", authenticate, authorize("admin"), requestController.deleteMaterialRequest);

// Attachment routes (legacy - for single attachment)
router.get(
  "/:id/attachment/download",
  authenticate,
  requestController.downloadMaterialRequestAttachment
);
router.get(
  "/:id/attachment/url",
  authenticate,
  requestController.getMaterialRequestAttachmentUrl
);

// Document routes (multiple documents support)
router.post(
  "/:id/documents",
  authenticate,
  authorize("admin", "engineer", "procurement_officer"),
  documentController.uploadMiddleware,
  documentController.uploadMaterialRequestDocument
);
router.get(
  "/documents/:id/download",
  authenticate,
  documentController.downloadMaterialRequestDocument
);
router.get(
  "/documents/:id/url",
  authenticate,
  documentController.getMaterialRequestDocumentUrl
);
router.delete(
  "/documents/:id",
  authenticate,
  authorize("admin", "engineer", "procurement_officer"),
  documentController.deleteMaterialRequestDocument
);

export default router;
