import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/stats", authenticate, dashboardController.getDashboardStats);

export default router;
