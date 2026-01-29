import { contextBridge, ipcRenderer } from 'electron';

// A "Ponte" segura entre o React e o Electron
// Nomes das funções aqui DEVEM ser iguais aos da interface ElectronAPI em src/types.ts
contextBridge.exposeInMainWorld('api', {

  // 1. Banco de Dados
  loadDatabase: () => ipcRenderer.invoke('db-load'),

  saveDatabase: (data: any) => ipcRenderer.invoke('db-save', data),

  // 2. Manipulação de Arquivos
  generateDocx: (data: any) => ipcRenderer.invoke('generate-docx', data),

  scanFiles: () => ipcRenderer.invoke('scan-files'),

  // 3. Sistema / Pastas
  openFolder: (type: 'os' | 'backup') => ipcRenderer.invoke('open-folder', type),

  openOsFile: (osId: number) => ipcRenderer.invoke('open-os-file', osId)
});