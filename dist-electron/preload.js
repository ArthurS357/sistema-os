"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// A "Ponte" segura entre o React e o Electron
// Nomes das funções aqui DEVEM ser iguais aos da interface ElectronAPI em src/types.ts
electron_1.contextBridge.exposeInMainWorld('api', {
    // 1. Banco de Dados
    loadDatabase: () => electron_1.ipcRenderer.invoke('db-load'),
    saveDatabase: (data) => electron_1.ipcRenderer.invoke('db-save', data),
    // 2. Manipulação de Arquivos
    generateDocx: (data) => electron_1.ipcRenderer.invoke('generate-docx', data),
    deleteOsFile: (osId) => electron_1.ipcRenderer.invoke('delete-os-file', osId),
    scanFiles: () => electron_1.ipcRenderer.invoke('scan-files'),
    // 3. Sistema / Pastas
    openFolder: (type) => electron_1.ipcRenderer.invoke('open-folder', type),
    openOsFile: (osId) => electron_1.ipcRenderer.invoke('open-os-file', osId)
});
