"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    loadDatabase: () => electron_1.ipcRenderer.invoke('db-load'),
    saveDatabase: (data) => electron_1.ipcRenderer.invoke('db-save', data),
    generateDocx: (data) => electron_1.ipcRenderer.invoke('generate-docx', data),
    scanFiles: () => electron_1.ipcRenderer.invoke('scan-files'),
    scanSingle: (osId) => electron_1.ipcRenderer.invoke('scan-single', osId),
    deleteOsFile: (osId) => electron_1.ipcRenderer.invoke('delete-os-file', osId),
    openFolder: (type) => electron_1.ipcRenderer.invoke('open-folder', type),
    openOsFile: (osId) => electron_1.ipcRenderer.invoke('open-os-file', osId),
});
