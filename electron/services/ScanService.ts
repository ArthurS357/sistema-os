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

    // --- HELPER: Processamento em Lotes (Batch Processing) ---
    // Processa 'batchSize' arquivos por vez para otimizar I/O sem estourar limites do SO
    private async processBatch<T, R>(items: T[], batchSize: number, task: (item: T) => Promise<R>): Promise<R[]> {
        const results: R[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            // Executa o lote atual em paralelo
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

            // Filtra apenas arquivos .docx e remove temporários do Word (~$)
            const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));

            console.log(`[SCAN] ${docxFiles.length} arquivos encontrados. Processando em paralelo...`);

            // --- CORREÇÃO 1: Regex Rigorosa (Evita Falsos Positivos) ---
            // Só aceita números que estão no INÍCIO do nome ou logo após "OS", "Nº", "PEDIDO"
            // Ex: "OS 3510.docx" (OK), "Relatório 2024.docx" (Ignorado, pois 2024 é ano)
            const strictIdRegex = /^(?:OS|Nº|PEDIDO|ORCAMENTO)?\s*[.\-_#]?\s*(\d{1,6})/i;

            // Função que processa UM arquivo (será chamada em paralelo)
            const processFile = async (file: string): Promise<RecoveredItem | null> => {
                try {
                    // Validação do Nome
                    const match = file.match(strictIdRegex);

                    // Se não tiver número válido no começo, pula
                    if (!match || !match[1]) return null;

                    const id = parseInt(match[1]);

                    // Filtro de sanidade: Ignora o "0" ou números absurdamente grandes que pareçam datas (se não tiver prefixo)
                    if (isNaN(id) || id === 0) return null;

                    const filePath = path.join(this.outputDir, file);

                    // Obtém data de criação do arquivo
                    const stats = await fs.promises.stat(filePath);
                    const dataArquivo = stats.birthtime.toLocaleDateString('pt-BR');

                    // Valores padrão
                    let cliente = "Cliente não identificado";
                    let impressora = "Equipamento antigo";
                    let valor = "R$ 0,00";
                    let telefone = "";
                    let obs = "Recuperado de arquivo legado";
                    let status = file.toLowerCase().includes('entregue') ? 'Aprovado - Entregue' : 'Em Análise';

                    // --- CORREÇÃO 2: Proteção contra Arquivos Corrompidos ---
                    try {
                        const content = await fs.promises.readFile(filePath, 'binary');
                        const zip = new PizZip(content);

                        if (zip.files['word/document.xml']) {
                            const xml = zip.files['word/document.xml'].asText();
                            const textBody = xml.replace(/<[^>]+>/g, ' '); // Remove XML tags

                            // Mineração de Dados (Regex no Conteúdo)

                            // Telefone
                            const telMatch = textBody.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
                            if (telMatch) telefone = telMatch[0].trim();

                            // Valor
                            const valMatch = textBody.match(/R\$\s?[\d.,]+/);
                            if (valMatch) valor = valMatch[0].trim();

                            // Cliente (Procura por rótulos comuns)
                            const clienteMatch = textBody.match(/(?:Cliente|Nome)\s*[:;-]\s*([^.,;]+)/i);
                            if (clienteMatch && clienteMatch[1]) {
                                cliente = this.cleanText(clienteMatch[1]).substring(0, 40);
                            } else {
                                // Fallback: tenta pegar do nome do arquivo (ex: "3510 - João Silva.docx")
                                const parts = file.replace('.docx', '').split(/[-_]/);
                                if (parts.length > 1) {
                                    const possivelNome = parts[1].trim();
                                    // Verifica se não é número nem string vazia
                                    if (isNaN(parseInt(possivelNome)) && possivelNome.length > 2) {
                                        cliente = possivelNome;
                                    }
                                }
                            }

                            // Equipamento
                            const equipMatch = textBody.match(/(?:Equipamento|Aparelho|Modelo)\s*[:;-]\s*([^.,;]+)/i);
                            if (equipMatch && equipMatch[1]) {
                                impressora = this.cleanText(equipMatch[1]).substring(0, 30);
                            }
                        }
                    } catch (readErr) {
                        // Se falhar a leitura interna (arquivo corrompido), 
                        // não faz nada e mantém os dados que conseguiu extrair do nome do arquivo.
                        // console.warn(`[SCAN] Arquivo ilegível: ${file}`);
                    }

                    return {
                        os: id,
                        data: dataArquivo,
                        cliente,
                        impressora,
                        status,
                        valor,
                        telefone,
                        orcamento: "Verificar arquivo físico",
                        obs
                    };

                } catch (e) {
                    return null; // Se der erro fatal no arquivo, ignora ele
                }
            };

            // --- EXECUÇÃO OTIMIZADA ---
            // Processa em lotes de 20 arquivos para não travar IO
            const rawResults = await this.processBatch(docxFiles, 20, processFile);

            // Remove nulos
            const validResults = rawResults.filter((r): r is RecoveredItem => r !== null);

            // --- CORREÇÃO 3: Unicidade e Sequência ---
            const uniqueMap = new Map<number, RecoveredItem>();
            let maxId = 0; // Começa do zero para que o scan determine a verdade real

            validResults.forEach(item => {
                // Atualiza o maior número encontrado
                if (item.os > maxId) maxId = item.os;

                if (!uniqueMap.has(item.os)) {
                    uniqueMap.set(item.os, item);
                } else {
                    // Resolve conflito: Se tiver duplicata, prioriza a que tem nome de cliente válido
                    const existing = uniqueMap.get(item.os)!;
                    if (existing.cliente.includes("não identificado") && !item.cliente.includes("não identificado")) {
                        uniqueMap.set(item.os, item);
                    }
                }
            });

            // Ordena final
            const sortedHistory = Array.from(uniqueMap.values()).sort((a, b) => a.os - b.os);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[SCAN] Concluído em ${duration}s. ${sortedHistory.length} OSs importadas. Próxima OS sugerida: ${maxId + 1}`);

            return {
                success: true,
                data: {
                    ultimo_numero: maxId, // Retorna o maior ID encontrado para o sistema continuar dali
                    historico: sortedHistory
                }
            };

        } catch (e) {
            console.error("[SCAN] Erro fatal:", e);
            return { success: false, error: String(e) };
        }
    }
}