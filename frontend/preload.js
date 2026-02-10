const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  invoke: (channel, data, ...args) => {
    return ipcRenderer.invoke(channel, data, ...args);
  }
});

contextBridge.exposeInMainWorld("electron", {
  openExternal: (url) => {
    if (typeof url === "string" && url) {
      ipcRenderer.send("open-external", url);
    }
  },
  onDeepLink: (callback) => {
    const subscription = (_event, url) => callback(url);
    ipcRenderer.on('deep-link', subscription);
    return () => ipcRenderer.removeListener('deep-link', subscription);
  }
});
