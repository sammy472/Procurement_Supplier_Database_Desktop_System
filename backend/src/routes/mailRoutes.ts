import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getMails,
  getMailById,
  createMail,
  updateMail,
  deleteMail,
  markRead,
  getAttachmentUrl,
  uploadAttachmentsMiddleware,
} from "../controllers/mailController";

const router = Router();

router.use((req, res, next) => {
  console.log(`[MAIL ROUTE] ${req.method} ${req.path}`);
  next();
});

router.get("/", authenticate, getMails);
router.get("/:id", authenticate, getMailById);
router.post("/", authenticate, uploadAttachmentsMiddleware, createMail);
router.put("/:id", authenticate, updateMail);
router.delete("/:id", authenticate, deleteMail);
router.patch("/:id/read", authenticate, markRead);
router.get("/attachments/:id/url", authenticate, getAttachmentUrl);

export default router;
