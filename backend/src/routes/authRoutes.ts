import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Debug logging
router.use((req, res, next) => {
  console.log(`[AUTH ROUTE] ${req.method} ${req.path}`);
  next();
});

router.post("/register", authenticate, authorize("admin"), authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authenticate, authController.logout);
router.get("/profile", authenticate, authController.getProfile);
router.put("/profile", authenticate, authController.updateProfile);
router.post("/change-password", authenticate, authController.changePassword);
router.post("/request-password-reset", authController.requestPasswordReset);
router.post("/reset-password", authController.resetPassword);
router.get(
  "/users",
  authenticate,
  authorize("admin", "procurement_officer", "engineer", "viewer"),
  authController.getUsers
);

export default router;
