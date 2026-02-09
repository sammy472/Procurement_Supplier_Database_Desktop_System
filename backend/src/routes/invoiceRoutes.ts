import express from "express";
import { authenticate } from "../middleware/auth";
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  exportInvoicePDF
} from "../controllers/invoiceController";

const router = express.Router();

router.use(authenticate);

router.get("/", getInvoices);
router.get("/:id", getInvoice);
router.get("/:id/pdf", exportInvoicePDF);
router.post("/", createInvoice);
router.patch("/:id", updateInvoice);
router.delete("/:id", deleteInvoice);

export default router;
