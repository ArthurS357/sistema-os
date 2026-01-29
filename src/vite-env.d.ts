/// <reference types="vite/client" />

interface Window {
  api: {
    loadDatabase: () => Promise<any>;
    saveDatabase: (data: any) => Promise<{ success: boolean; error?: string }>;
    generateDocx: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>;
    scanFiles: () => Promise<{ success: boolean; data?: any; count?: number; error?: string }>;
    
    // Novos tipos
    openFolder: (type: 'os' | 'backup') => Promise<void>;
    openOsFile: (osId: number) => Promise<{ success: boolean; error?: string }>;
  }
}