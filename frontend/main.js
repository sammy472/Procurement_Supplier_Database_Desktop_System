import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

// Register protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('onk-savvy', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('onk-savvy')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      
      // Find the argument that starts with onk-savvy://
      const url = commandLine.find(arg => arg.startsWith('onk-savvy://'));
      if (url) {
        mainWindow.webContents.send('deep-link', url)
      }
    }
  })

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Correct way to load Vite build in Electron (fixes CORS issue)
    const indexHtmlPath = path.join(__dirname, "dist", "index.html");
    mainWindow.loadURL(pathToFileURL(indexHtmlPath).toString());

    // DevTools for debugging (remove in production if desired)
    //mainWindow.webContents.openDevTools();
    
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createWindow();
    
    // Handle deep link on macOS
    app.on('open-url', (event, url) => {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.webContents.send('deep-link', url);
      }
    });
    
    // Handle deep link at first launch (Windows/Linux)
    const deeplinkArg = process.argv.find(arg => typeof arg === 'string' && arg.startsWith('onk-savvy://'));
    if (deeplinkArg && mainWindow) {
      mainWindow.webContents.send('deep-link', deeplinkArg);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

  // IPC to open external links in system browser
  ipcMain.on("open-external", (_event, url) => {
    if (typeof url === "string" && url) {
      shell.openExternal(url);
    }
  });
  
  // IPC: Open a folder in system file explorer
  ipcMain.handle("open-folder", async (_event, dirPath) => {
    if (typeof dirPath !== "string" || !dirPath.trim()) {
      throw new Error("Invalid folder path");
    }
    try {
      await shell.openPath(dirPath);
      return true;
    } catch (e) {
      throw e;
    }
  });
  
  // IPC: Generate PDF from raw HTML using Electron's printToPDF
  ipcMain.handle("pdf:generateFromHtml", async (_event, html, opts = {}) => {
    if (typeof html !== "string" || !html.trim()) {
      throw new Error("Invalid HTML content");
    }
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });
    try {
      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      await win.loadURL(dataUrl);
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        marginsType: 0,
        ...opts,
      });
      const outDir = path.join(app.getPath("temp"), "onk-savvy-pdfs");
      await (await import("fs/promises")).mkdir(outDir, { recursive: true });
      const filename = `invoice-${Date.now()}.pdf`;
      const outPath = path.join(outDir, filename);
      await (await import("fs/promises")).writeFile(outPath, pdfBuffer);
      return { path: outPath, size: pdfBuffer.length };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  });
  
  // IPC: Generate PDF from raw HTML using Puppeteer (client-side)
  ipcMain.handle("pdf:generateWithPuppeteer", async (_event, html, opts = {}) => {
    if (typeof html !== "string" || !html.trim()) {
      throw new Error("Invalid HTML content");
    }
    let puppeteer;
    let useElectron = false;
    try {
      // Attempt dynamic import; fallback to Electron printToPDF if unavailable
      ({ default: puppeteer } = await import("puppeteer"));
    } catch {
      useElectron = true;
    }
    if (!useElectron) {
      try {
        const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--no-zygote"];
        const browser = await puppeteer.launch({ headless: "new", args });
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "load" });
          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
            ...opts,
          });
          return { base64: Buffer.from(pdfBuffer).toString("base64"), size: pdfBuffer.length };
        } finally {
          await browser.close();
        }
      } catch {
        useElectron = true;
      }
    }
    // Fallback: use Electron's printToPDF, return base64 (no file writes)
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });
    try {
      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      await win.loadURL(dataUrl);
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        marginsType: 0,
        ...opts,
      });
      return { base64: Buffer.from(pdfBuffer).toString("base64"), size: pdfBuffer.length };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  });
}
