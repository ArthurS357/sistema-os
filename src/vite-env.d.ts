/// <reference types="vite/client" />

interface Window {
  api: {
    loadDatabase: () => Promise<any>;
    saveDatabase: (data: any) => Promise<any>;
    generateDocx: (data: any) => Promise<any>;
    scanFiles: () => Promise<any>;

    // --- ADICIONE ESTA LINHA ---
    scanSingle: (osId: number) => Promise<any>;
    // ---------------------------

    deleteOsFile: (osId: number) => Promise<any>;
    openFolder: (type: 'os' | 'backup') => Promise<void>;
    openOsFile: (osId: number) => Promise<any>;
  }
}