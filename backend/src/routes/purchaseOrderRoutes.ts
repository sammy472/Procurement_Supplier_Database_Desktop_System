import { Router } from "express";
import * as poController from "../controllers/purchaseOrderController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, poController.getPurchaseOrders);
router.get("/:id", authenticate, poController.getPurchaseOrder);
router.get("/:id/pdf", authenticate, poController.exportPurchaseOrderPDF);
router.post("/:id/email", authenticate, poController.emailPurchaseOrderPDF);
router.post("/", authenticate, authorize("admin", "procurement_officer"), poController.createPurchaseOrder);
router.put("/:id", authenticate, authorize("admin", "procurement_officer"), poController.updatePurchaseOrder);
router.delete("/:id", authenticate, authorize("admin"), poController.deletePurchaseOrder);

export default router;
