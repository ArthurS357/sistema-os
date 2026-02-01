import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  loadDatabase: () => ipcRenderer.invoke('db-load'),
  saveDatabase: (data: any) => ipcRenderer.invoke('db-save', data),
  generateDocx: (data: any) => ipcRenderer.invoke('generate-docx', data),
  scanFiles: () => ipcRenderer.invoke('scan-files'),
  scanSingle: (osId: number) => ipcRenderer.invoke('scan-single', osId),
  deleteOsFile: (osId: number) => ipcRenderer.invoke('delete-os-file', osId),
  openFolder: (type: string) => ipcRenderer.invoke('open-folder', type),
  openOsFile: (osId: number) => ipcRenderer.invoke('open-os-file', osId),
});