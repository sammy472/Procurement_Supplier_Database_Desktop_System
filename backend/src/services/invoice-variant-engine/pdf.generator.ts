import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
const cacheDir = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
process.env.PUPPETEER_CACHE_DIR = cacheDir;
// Guard against wildcard or misconfigured env path taking precedence inside Puppeteer
if ((process.env as any).PUPPETEER_EXECUTABLE_PATH && String(process.env.PUPPETEER_EXECUTABLE_PATH).includes("*")) {
  delete (process.env as any).PUPPETEER_EXECUTABLE_PATH;
}

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
  // Use Puppeteer's bundled executable if available
  try {
    const p = puppeteer.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  try {
    const renderCache = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
    const chromeBase = path.join(renderCache, "chrome");
    if (fs.existsSync(chromeBase)) {
      const entries = fs.readdirSync(chromeBase, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("linux-"));
      entries.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const dir of entries) {
        const c1 = path.join(chromeBase, dir.name, "chrome-linux64", "chrome");
        const c2 = path.join(chromeBase, dir.name, "chrome-linux", "chrome");
        if (fs.existsSync(c1)) return c1;
        if (fs.existsSync(c2)) return c2;
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
        const candidate2 = path.join(base, dir.name, "chrome-linux", "chrome");
        if (fs.existsSync(candidate)) return candidate;
        if (fs.existsSync(candidate2)) return candidate2;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function getChromiumOptions():
  Promise<{ executablePath?: string; args?: string[]; headless?: boolean; defaultViewport?: any } | undefined> {
  try {
    const chromium: any = await import("@sparticuz/chromium");
    const executablePath: string | null = await chromium.executablePath();
    if (executablePath) {
      return {
        executablePath,
        args: Array.isArray(chromium.args) ? chromium.args : undefined,
        headless: typeof chromium.headless === "boolean" ? chromium.headless : undefined,
        defaultViewport: chromium.defaultViewport,
      };
    }
  } catch {}
  return undefined;
}

async function launchBrowserWithFallback(): Promise<Browser> {
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
  const candidates: string[] = [];
  const resolved = resolveExecutablePath();
  if (resolved) candidates.push(resolved);
  const sysPaths = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/opt/google/chrome/chrome"];
  for (const p of sysPaths) {
    if (fs.existsSync(p)) candidates.push(p);
  }
  const tried: string[] = [];
  let lastError: any;
  for (const execPath of candidates) {
    tried.push(execPath);
    try {
      return await puppeteer.launch({ headless: "new" as any, args, executablePath: execPath });
    } catch (e) {
      lastError = e;
    }
  }
  // Try Puppeteer default (bundled Chromium) without explicit executablePath
  try {
    return await puppeteer.launch({ headless: "new" as any, args });
  } catch (e) {
    lastError = e;
  }
  const detail = tried.length
    ? `Tried executablePath(s): ${tried.join(", ")}`
    : "No executablePath candidates found; default launch also failed";
  const err = new Error(`Chromium launch failed. ${detail}`);
  (err as any).cause = lastError;
  throw err;
}

export async function generatePdfFromHtml(html: string, outputDir: string, fileBaseName: string): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const safeBase = String(fileBaseName || "invoice").replace(/[^a-zA-Z0-9._-]/g, "");
  const outputPath = path.join(outputDir, `${safeBase}.pdf`);
  const browser = await launchBrowserWithFallback();
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
  const browser = await launchBrowserWithFallback();
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
