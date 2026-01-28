import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getAuthUrl,
  oauthCallback,
  listMessages,
  getMessage,
  sendMessage,
  deleteMessage,
  markRead,
  getLinkedAccounts,
} from "../controllers/providerMailController";

const router = Router();

router.get("/linked", authenticate, getLinkedAccounts);
router.get("/:provider/auth-url", authenticate, getAuthUrl);
router.get("/:provider/callback", oauthCallback);
router.get("/:provider/messages", authenticate, listMessages);
router.get("/:provider/messages/:id", authenticate, getMessage);
router.post("/:provider/messages", authenticate, sendMessage);
router.delete("/:provider/messages/:id", authenticate, deleteMessage);
router.patch("/:provider/messages/:id/read", authenticate, markRead);

export default router;
