import { Router } from "express";
import * as tenderController from "../controllers/tenderController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, tenderController.getTenders);
router.get("/:id", authenticate, tenderController.getTender);
router.post(
  "/",
  authenticate,
  authorize("admin", "procurement_officer"),
  tenderController.createTender
);
router.put(
  "/:id",
  authenticate,
  tenderController.updateTender
);
router.delete(
  "/:id",
  authenticate,
  tenderController.deleteTender
);

router.post(
  "/:id/tasks",
  authenticate,
  tenderController.createTenderTask
);
router.put(
  "/tasks/:taskId",
  authenticate,
  tenderController.updateTenderTask
);
router.delete(
  "/tasks/:taskId",
  authenticate,
  tenderController.deleteTenderTask
);
router.post(
  "/tasks/:taskId/upload",
  authenticate,
  tenderController.uploadTaskFileMiddleware,
  tenderController.uploadTaskFile
);

router.get(
  "/tasks/:taskId/file-url",
  authenticate,
  tenderController.getTenderTaskFileUrl
);

router.delete(
  "/tasks/:taskId/file",
  authenticate,
  tenderController.deleteTenderTaskFile
);

router.get("/:id/pdf", authenticate, tenderController.getTenderPdf);
router.post("/:id/merge-documents", authenticate, tenderController.mergeTenderDocuments);
router.get("/:id/merged-document", authenticate, tenderController.getMergedDocument);
router.delete("/:id/merged-document", authenticate, tenderController.deleteMergedDocument);
router.get("/:id/merged-document/download", authenticate, tenderController.downloadMergedDocument);

export default router;
