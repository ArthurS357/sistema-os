import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

interface RecoveredItem {
    os: number;
    data: string;
    cliente: string;
    impressora: string;
    status: string;
    valor: string;
    telefone: string;
    orcamento: string;
    obs: string;
}

export class ScanService {
    private outputDir: string;

    constructor(outputDir: string) {
        this.outputDir = outputDir;
    }

    private cleanText(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    // --- NOVA FUNÇÃO AUXILIAR: Extrai dados de um único arquivo ---
    // Centraliza a lógica de leitura para ser usada tanto no Scan Geral quanto no Scan Único
    private async extractInfoFromFile(filePath: string, id: number): Promise<RecoveredItem | null> {
        try {
            const stats = await fs.promises.stat(filePath);
            const dataArquivo = stats.birthtime.toLocaleDateString('pt-BR');
            const fileName = path.basename(filePath);

            let cliente = "Cliente não identificado";
            let impressora = "Equipamento antigo";
            let valor = "R$ 0,00";
            let telefone = "";
            let obs = "Sincronizado do arquivo";
            let status = fileName.toLowerCase().includes('entregue') ? 'Aprovado - Entregue' : 'Em Análise';
            let defeito = "Verificar arquivo físico";

            // Tenta ler o conteúdo interno do Word
            try {
                const content = await fs.promises.readFile(filePath, 'binary');
                const zip = new PizZip(content);

                if (zip.files['word/document.xml']) {
                    const xml = zip.files['word/document.xml'].asText();
                    const textBody = xml.replace(/<[^>]+>/g, ' ');

                    // Mineração de Dados via Regex
                    const telMatch = textBody.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
                    if (telMatch) telefone = telMatch[0].trim();

                    const valMatch = textBody.match(/R\$\s?[\d.,]+/);
                    if (valMatch) valor = valMatch[0].trim();

                    const clienteMatch = textBody.match(/(?:Cliente|Nome)\s*[:;-]\s*([^.,;]+)/i);
                    if (clienteMatch && clienteMatch[1]) {
                        cliente = this.cleanText(clienteMatch[1]).substring(0, 40);
                    } else {
                        // Fallback para nome do arquivo
                        const parts = fileName.replace('.docx', '').split(/[-_]/);
                        if (parts.length > 1) {
                            const possivelNome = parts[1].trim();
                            if (isNaN(parseInt(possivelNome)) && possivelNome.length > 2) cliente = possivelNome;
                        }
                    }

                    const equipMatch = textBody.match(/(?:Equipamento|Aparelho|Modelo)\s*[:;-]\s*([^.,;]+)/i);
                    if (equipMatch && equipMatch[1]) {
                        impressora = this.cleanText(equipMatch[1]).substring(0, 30);
                    }
                }
            } catch (readErr) {
                // Se o arquivo estiver corrompido, apenas loga e segue com dados básicos extraídos do nome
                // console.warn(`[SCAN] Erro leitura interna: ${fileName}`);
            }

            return {
                os: id,
                data: dataArquivo,
                cliente, impressora, status, valor, telefone,
                orcamento: defeito,
                obs
            };
        } catch (e) {
            return null;
        }
    }

    // --- HELPER: Processamento em Lotes (Batch Processing) ---
    private async processBatch<T, R>(items: T[], batchSize: number, task: (item: T) => Promise<R>): Promise<R[]> {
        const results: R[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(task));
            results.push(...batchResults);
        }
        return results;
    }

    public async scanFiles(): Promise<{ success: boolean; data?: { ultimo_numero: number; historico: RecoveredItem[] }; error?: string }> {
        console.log("[SCAN] Iniciando Varredura Otimizada...");
        const startTime = Date.now();

        try {
            if (!fs.existsSync(this.outputDir)) return { success: false, data: { ultimo_numero: 0, historico: [] } };

            const files = await fs.promises.readdir(this.outputDir);
            const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));

            console.log(`[SCAN] ${docxFiles.length} arquivos encontrados. Processando em paralelo...`);

            // Regex Rigorosa: Número deve estar no início ou após prefixo
            const strictIdRegex = /^(?:OS|Nº|PEDIDO|ORCAMENTO)?\s*[.\-_#]?\s*(\d{1,6})/i;

            const processFile = async (file: string): Promise<RecoveredItem | null> => {
                const match = file.match(strictIdRegex);
                if (!match || !match[1]) return null;

                const id = parseInt(match[1]);
                if (isNaN(id) || id === 0) return null;

                // Reutiliza a lógica centralizada
                return await this.extractInfoFromFile(path.join(this.outputDir, file), id);
            };

            // Executa em lotes de 20 para performance
            const rawResults = await this.processBatch(docxFiles, 20, processFile);

            const validResults = rawResults.filter((r): r is RecoveredItem => r !== null);

            // Unicidade e Sequência
            const uniqueMap = new Map<number, RecoveredItem>();
            let maxId = 0;

            validResults.forEach(item => {
                if (item.os > maxId) maxId = item.os;

                if (!uniqueMap.has(item.os)) {
                    uniqueMap.set(item.os, item);
                } else {
                    const existing = uniqueMap.get(item.os)!;
                    // Prioriza registro com nome de cliente válido
                    if (existing.cliente.includes("não identificado") && !item.cliente.includes("não identificado")) {
                        uniqueMap.set(item.os, item);
                    }
                }
            });

            const sortedHistory = Array.from(uniqueMap.values()).sort((a, b) => a.os - b.os);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`[SCAN] Concluído em ${duration}s. ${sortedHistory.length} OSs importadas. Próxima OS: ${maxId + 1}`);

            return {
                success: true,
                data: {
                    ultimo_numero: maxId,
                    historico: sortedHistory
                }
            };

        } catch (e) {
            console.error("[SCAN] Erro fatal:", e);
            return { success: false, error: String(e) };
        }
    }

    // --- NOVA FUNÇÃO: Sincronizar Arquivo Único (Para edição manual) ---
    public async syncSingleFile(osId: number): Promise<{ success: boolean; data?: RecoveredItem; error?: string }> {
        try {
            const files = await fs.promises.readdir(this.outputDir);
            // Regex específica para encontrar o arquivo desse ID
            const idRegex = new RegExp(`^(?:OS|Nº|PEDIDO|ORCAMENTO)?\\s*[.\\-_#]?\\s*${osId}(?:\\s|\\.|-|_)`, 'i');

            const targetFile = files.find(f => f.endsWith('.docx') && !f.startsWith('~$') && idRegex.test(f));

            if (!targetFile) {
                return { success: false, error: "Arquivo físico não encontrado." };
            }

            const recoveredData = await this.extractInfoFromFile(path.join(this.outputDir, targetFile), osId);

            if (recoveredData) {
                return { success: true, data: recoveredData };
            } else {
                return { success: false, error: "Falha ao ler o arquivo." };
            }

        } catch (e) {
            return { success: false, error: String(e) };
        }
    }
}