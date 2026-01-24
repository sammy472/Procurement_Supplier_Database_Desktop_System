import { PDFDocument, StandardFonts } from "pdf-lib";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import DocxMerger from "docx-merger";
import { spawn } from "child_process";
import mammoth from "mammoth";

export async function convertOfficeToPdf(inputBuffer: Buffer, ext: string): Promise<Buffer> {
  const dir = tmpdir();
  const inPath = join(dir, `office_${Date.now()}.${ext}`);
  const outPath = inPath.replace(new RegExp(`\\.${ext}$`, "i"), ".pdf");
  await writeFile(inPath, inputBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      const bin = resolveSofficeBinary();
      const p = spawn(bin, ["--headless", "--convert-to", "pdf", "--outdir", dir, inPath]);
      p.on("error", reject);
      p.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error("LibreOffice conversion failed"));
      });
    });
    const pdfBuf = await readFile(outPath);
    return pdfBuf;
  } catch (err) {
    if (/^docx$/i.test(ext)) {
      const fallback = await convertDocxToPdfFallback(inputBuffer);
      return fallback;
    }
    throw err;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const out = await merged.save();
  return Buffer.from(out);
}

export async function mergeDocxBuffers(buffers: Buffer[]): Promise<Buffer> {
  const files = buffers.map((b) => b.toString("binary"));
  const docx = new DocxMerger({}, files);
  const merged: Buffer = await new Promise((resolve, reject) => {
    try {
      docx.save("nodebuffer", (data: Buffer) => resolve(data));
    } catch (e) {
      reject(e);
    }
  });
  return merged;
}

export async function convertImageToPdf(inputBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let img;
  if (/jpe?g/i.test(mimeType)) {
    img = await pdf.embedJpg(inputBuffer);
  } else {
    img = await pdf.embedPng(inputBuffer);
  }
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const out = await pdf.save();
  return Buffer.from(out);
}

function resolveSofficeBinary(): string {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  const candidates = [
    "soffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
  ];
  for (const c of candidates) {
    if (c.includes("\\") || c.startsWith("/")) {
      if (existsSync(c)) return c;
    } else {
      return c;
    }
  }
  return "soffice";
}

export async function convertDocxToPdfFallback(buffer: Buffer): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const margin = { top: 50, bottom: 50, left: 50, right: 50 };
  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const usableWidth = pageWidth - margin.left - margin.right;
  const lineHeight = fontSize * 1.4;

  const words = text.split(" ");
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let x = margin.left;
  let y = pageHeight - margin.top;
  let line = "";

  const flushLine = () => {
    if (!line) return;
    page.drawText(line, {
      x,
      y,
      size: fontSize,
      font,
    });
    y -= lineHeight;
    line = "";
    if (y < margin.bottom + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin.top;
    }
  };

  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(next, fontSize);
    if (width > usableWidth) {
      flushLine();
      line = w;
    } else {
      line = next;
    }
  }
  flushLine();

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
