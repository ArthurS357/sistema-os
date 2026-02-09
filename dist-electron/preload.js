"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  loadDatabase: () => electron.ipcRenderer.invoke("db-load"),
  saveDatabase: (data) => electron.ipcRenderer.invoke("db-save", data),
  generateDocx: (data) => electron.ipcRenderer.invoke("generate-docx", data),
  scanFiles: () => electron.ipcRenderer.invoke("scan-files"),
  scanSingle: (osId) => electron.ipcRenderer.invoke("scan-single", osId),
  deleteOsFile: (osId) => electron.ipcRenderer.invoke("delete-os-file", osId),
  openFolder: (type) => electron.ipcRenderer.invoke("open-folder", type),
  openOsFile: (osId) => electron.ipcRenderer.invoke("open-os-file", osId)
});
