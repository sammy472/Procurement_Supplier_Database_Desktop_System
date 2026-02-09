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
}