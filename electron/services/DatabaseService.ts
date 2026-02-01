import fs from 'fs';

// Definimos uma interface básica aqui para não depender da pasta 'src'
// (evita erros de compilação cruzada no TypeScript do Electron)
interface OSHistoryItem {
    os: number;
    cliente: string;
    // ... outros campos não são estritamente necessários para a validação
}

interface Database {
    ultimo_numero: number;
    historico: OSHistoryItem[];
}

export class DatabaseService {
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    public async load(): Promise<Database> {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = await fs.promises.readFile(this.dbPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error("[DB] Erro ao carregar:", error);
        }
        // Retorna estrutura padrão se falhar ou não existir
        return { ultimo_numero: 3825, historico: [] };
    }

    public async save(data: Database): Promise<{ success: boolean; error?: string }> {
        try {
            // --- TRAVA DE SEGURANÇA (ANTI-WIPE) ---
            // Protege contra bugs do frontend que enviem arrays vazios
            if (!data || !Array.isArray(data.historico)) {
                return { success: false, error: "Dados inválidos ou corrompidos." };
            }

            // Se o novo histórico estiver vazio, verificamos se o banco atual tem dados.
            // Se o banco atual tiver muitos dados (>10), bloqueamos o salvamento vazio.
            if (data.historico.length === 0 && fs.existsSync(this.dbPath)) {
                const currentData = await this.load();
                if (currentData.historico.length > 10) {
                    console.warn("[DB] BLOQUEIO DE SEGURANÇA: Tentativa de zerar o banco detectada.");
                    return {
                        success: false,
                        error: "Bloqueio de Segurança: O sistema tentou apagar todos os registros. Operação cancelada."
                    };
                }
            }
            // ---------------------------------------

            const jsonContent = JSON.stringify(data, null, 4);
            const tempPath = `${this.dbPath}.tmp`;

            // Escrita Atômica (Grava no temp -> Renomeia)
            // Isso evita arquivo corrompido se o PC desligar durante o salvamento
            await fs.promises.writeFile(tempPath, jsonContent, 'utf-8');
            await fs.promises.rename(tempPath, this.dbPath);

            return { success: true };
        } catch (error) {
            console.error("[DB] Erro ao salvar:", error);
            return { success: false, error: String(error) };
        }
    }
}