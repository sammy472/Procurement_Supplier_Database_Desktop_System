import { Router } from "express";
import * as notificationController from "../controllers/notificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All notification routes require authentication
router.get("/", authenticate, notificationController.getNotifications);
router.get("/unread-count", authenticate, notificationController.getUnreadCount);
router.put("/:id/read", authenticate, notificationController.markAsRead);
router.put("/:id/unread", authenticate, notificationController.markAsUnread);
router.put("/mark-all-read", authenticate, notificationController.markAllAsRead);
router.delete("/:id", authenticate, notificationController.deleteNotification);
router.delete("/read/all", authenticate, notificationController.deleteAllRead);

export default router;
