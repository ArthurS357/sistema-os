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