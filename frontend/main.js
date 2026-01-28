import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
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
  win.loadURL(pathToFileURL(indexHtmlPath).toString());

  // DevTools for debugging (remove in production if desired)
  //win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

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
