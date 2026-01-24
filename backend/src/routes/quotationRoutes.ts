import { Router } from "express";
import * as quotationController from "../controllers/quotationController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, quotationController.getQuotations);
router.get("/:id", authenticate, quotationController.getQuotation);
router.get("/:id/pdf", authenticate, quotationController.exportQuotationPDF);
router.post("/:id/email", authenticate, quotationController.emailQuotationPDF);
router.post("/", authenticate, authorize("admin", "procurement_officer"), quotationController.createQuotation);
router.put("/:id", authenticate, authorize("admin", "procurement_officer"), quotationController.updateQuotation);
router.delete("/:id", authenticate, authorize("admin"), quotationController.deleteQuotation);

export default router;
