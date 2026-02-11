import { Router } from "express";
import multer from "multer";
import { generateVariantsHandler, streamInvoiceFileInline, streamInvoiceFileDownload, uploadClientPdfHandler } from "../controllers/invoiceVariantController";
import { authenticate } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/generate", authenticate, generateVariantsHandler);
router.post("/upload", authenticate, upload.single("file"), uploadClientPdfHandler);
router.get("/files/:filename", streamInvoiceFileInline);
router.get("/download/:filename", streamInvoiceFileDownload);

export default router;
