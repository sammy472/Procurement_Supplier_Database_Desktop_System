import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

export async function generatePdfFromHtml(html: string, outputDir: string, fileBaseName: string): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const safeBase = String(fileBaseName || "invoice").replace(/[^a-zA-Z0-9._-]/g, "");
  const outputPath = path.join(outputDir, `${safeBase}.pdf`);
  const browser = await puppeteer.launch({
    headless: "new" as any,
    executablePath: puppeteer.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
  });
  await browser.close();
  await fs.promises.writeFile(outputPath, pdfBuffer);
  return outputPath;
}

export async function generatePdfBufferFromHtml(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: "new" as any,
    executablePath: puppeteer.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
  });
  await browser.close();
  return Buffer.from(pdfBuffer);
}
