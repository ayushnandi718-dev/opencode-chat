const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("opencodeDesktop", {
  serverUrl: "http://127.0.0.1:4096",
  uiOrigin: "http://localhost:5173",
  saveMemory: (text) => ipcRenderer.invoke("memory:save", text),
})
