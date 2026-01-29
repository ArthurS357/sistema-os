import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  loadDatabase: () => ipcRenderer.invoke('db-load'),
  saveDatabase: (data: any) => ipcRenderer.invoke('db-save', data),
  generateDocx: (data: any) => ipcRenderer.invoke('generate-docx', data),
  scanFiles: () => ipcRenderer.invoke('scan-files'),
  
  // Novos
  openFolder: (type: 'os' | 'backup') => ipcRenderer.invoke('open-folder', type),
  openOsFile: (osId: number) => ipcRenderer.invoke('open-os-file', osId)
});