const { contextBridge, ipcRenderer, shell } = require("electron");

contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  }
});

contextBridge.exposeInMainWorld("electron", {
  openExternal: (url) => {
    if (typeof url === "string" && url) {
      shell.openExternal(url);
    }
  }
});
