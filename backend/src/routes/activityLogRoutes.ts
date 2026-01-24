import { Router } from "express";
import * as activityLogController from "../controllers/activityLogController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize("admin"), activityLogController.getActivityLogs);

export default router;
