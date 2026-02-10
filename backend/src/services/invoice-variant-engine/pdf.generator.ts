import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
const cacheDir = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
process.env.PUPPETEER_CACHE_DIR = cacheDir;

function resolveExecutablePath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
  const p = puppeteer.executablePath();
  if (p && fs.existsSync(p)) {
    return p;
  }
  return undefined;
}

export async function generatePdfFromHtml(html: string, outputDir: string, fileBaseName: string): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const safeBase = String(fileBaseName || "invoice").replace(/[^a-zA-Z0-9._-]/g, "");
  const outputPath = path.join(outputDir, `${safeBase}.pdf`);
  const execPath = resolveExecutablePath();
  const launchOpts: any = {
    headless: "new" as any,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  if (execPath) {
    launchOpts.executablePath = execPath;
  }
  const browser = await puppeteer.launch(launchOpts);
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
  const execPath = resolveExecutablePath();
  const launchOpts: any = {
    headless: "new" as any,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  if (execPath) {
    launchOpts.executablePath = execPath;
  }
  const browser = await puppeteer.launch(launchOpts);
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
