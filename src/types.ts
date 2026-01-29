// --- Entidades de Dados ---
export interface OSHistoryItem {
    os: number;
    data: string;
    cliente: string;
    telefone: string;
    impressora: string;
    orcamento: string;
    valor: string;
    obs: string;
    status: string;
}

export interface Database {
    ultimo_numero: number;
    historico: OSHistoryItem[];
}

export interface OSFormState {
    cliente: string;
    telefone: string;
    impressora: string;
    orcamento: string;
    valor: string;
    obs: string;
    status: string;
    cabos: {
        forca: boolean;
        usb: boolean;
        cartuchos: boolean;
        ligando: boolean;
    };
}

// --- Tipagem do Retorno das Ações ---
export interface ActionResult {
    success: boolean;
    error?: string;
}

export interface DocxResult extends ActionResult {
    path?: string;
}

export interface ScanResult extends ActionResult {
    data?: Database;
    count?: number;
}

// --- Interface da Ponte Electron (Window.api) ---
// Define exatamente o que o preload.ts expõe
export interface ElectronAPI {
    loadDatabase: () => Promise<Database>;
    saveDatabase: (data: Database) => Promise<ActionResult>;
    generateDocx: (data: OSHistoryItem) => Promise<DocxResult>;
    scanFiles: () => Promise<ScanResult>;
    openFolder: (type: 'os' | 'backup') => Promise<void>;
    openOsFile: (osId: number) => Promise<ActionResult>;
}