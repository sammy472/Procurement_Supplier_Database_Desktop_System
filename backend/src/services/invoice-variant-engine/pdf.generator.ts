import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
const cacheDir = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
process.env.PUPPETEER_CACHE_DIR = cacheDir;

function resolveWildcardExecutablePath(pattern: string): string | undefined {
  if (!pattern.includes("*")) {
    return fs.existsSync(pattern) ? pattern : undefined;
  }
  try {
    // Handle typical Render pattern: /opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome
    const renderCache = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
    const chromeBase = path.join(renderCache, "chrome");
    if (fs.existsSync(chromeBase)) {
      const entries = fs.readdirSync(chromeBase, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("linux-"));
      entries.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const dir of entries) {
        const candidate = path.join(chromeBase, dir.name, "chrome-linux64", "chrome");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {}
  return undefined;
}

function resolveExecutablePath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    const direct = fs.existsSync(envPath) ? envPath : undefined;
    const globbed = direct ? direct : resolveWildcardExecutablePath(envPath);
    if (globbed) {
      return globbed;
    }
    delete (process.env as any).PUPPETEER_EXECUTABLE_PATH;
  }
  const p = puppeteer.executablePath();
  if (p) {
    const direct = fs.existsSync(p) ? p : undefined;
    const globbed = direct ? direct : resolveWildcardExecutablePath(p);
    if (globbed) {
      return globbed;
    }
  }
  try {
    const renderCache = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
    const chromeBase = path.join(renderCache, "chrome");
    if (fs.existsSync(chromeBase)) {
      const entries = fs.readdirSync(chromeBase, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("linux-"));
      entries.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const dir of entries) {
        const candidate = path.join(chromeBase, dir.name, "chrome-linux64", "chrome");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {}
  // Fallback: search node_modules/puppeteer/.local-chromium
  try {
    const base = path.join(process.cwd(), "node_modules", "puppeteer", ".local-chromium");
    if (fs.existsSync(base)) {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      const linuxDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith("linux-"));
      // Prefer latest by sorting desc
      linuxDirs.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const dir of linuxDirs) {
        const candidate = path.join(base, dir.name, "chrome-linux64", "chrome");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // ignore
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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
