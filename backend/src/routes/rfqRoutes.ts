import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import * as rfqController from "../controllers/rfqController";

const router = Router();

router.use((req, res, next) => {
  console.log(`[RFQ ROUTE] ${req.method} ${req.path}`);
  next();
});

router.get("/", authenticate, rfqController.getRfqs);
router.get("/:id", authenticate, rfqController.getRfq);
router.post("/", authenticate, authorize("admin", "procurement_officer"), rfqController.createRfq);
router.patch("/:id", authenticate, authorize("admin", "procurement_officer"), rfqController.updateRfq);
router.patch("/:id/resolved", authenticate, authorize("admin", "procurement_officer"), rfqController.toggleResolved);
router.delete("/:id", authenticate, authorize("admin", "procurement_officer"), rfqController.deleteRfq);

export default router;
