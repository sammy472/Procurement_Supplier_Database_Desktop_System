import { Router } from "express";
import { generateVariantsHandler, streamInvoiceFileInline, streamInvoiceFileDownload } from "../controllers/invoiceVariantController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/generate", authenticate, generateVariantsHandler);
router.get("/files/:filename", streamInvoiceFileInline);
router.get("/download/:filename", streamInvoiceFileDownload);

export default router;
