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

    // Helper para limpar strings sujas extraídas do XML do Word
    private cleanText(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    public async scanFiles(): Promise<{ success: boolean; data?: { ultimo_numero: number; historico: RecoveredItem[] }; error?: string }> {
        console.log("[SCAN] Iniciando Varredura Profunda (Deep Scan)...");
        try {
            if (!fs.existsSync(this.outputDir)) return { success: false, data: { ultimo_numero: 0, historico: [] } };

            const files = await fs.promises.readdir(this.outputDir);
            const recovered: RecoveredItem[] = [];
            let maxId = 3825;

            // Regex flexível para achar ID no nome do arquivo (ex: "OS 1050.docx", "1050.docx", "Pedido 1050...")
            const idRegex = /(\d{3,6})/;

            // Filtra apenas arquivos .docx e ignora arquivos temporários do Word (~$)
            const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));

            console.log(`[SCAN] Encontrados ${docxFiles.length} arquivos. Iniciando processamento...`);

            // Loop percorre TODOS os arquivos encontrados (sem limite de 100)
            for (const file of docxFiles) {

                // 1. Tenta extrair ID do nome do arquivo
                const match = file.match(idRegex);

                if (match && match[1]) {
                    const id = parseInt(match[1]);

                    if (!isNaN(id) && id > 0) {
                        if (id > maxId) maxId = id;

                        // Pega a data de criação do arquivo físico para usar como Data da OS
                        const stats = await fs.promises.stat(path.join(this.outputDir, file));
                        const dataArquivo = stats.birthtime.toLocaleDateString('pt-BR');

                        // --- ESTRATÉGIA DE MINERAÇÃO DE DADOS ---
                        // Valores padrão caso a leitura falhe
                        let cliente = "Cliente não identificado";
                        let impressora = "Equipamento antigo";
                        let valor = "R$ 0,00";
                        let telefone = "";
                        let obs = "Recuperado de arquivo legado";
                        let defeito = "Verificar arquivo físico";

                        // Tenta ler o conteúdo interno do Word
                        try {
                            const content = await fs.promises.readFile(path.join(this.outputDir, file), 'binary');
                            const zip = new PizZip(content);

                            if (zip.files['word/document.xml']) {
                                // Extrai o XML e remove as tags para sobrar apenas o texto puro
                                const xml = zip.files['word/document.xml'].asText();
                                const textBody = xml.replace(/<[^>]+>/g, ' ');

                                // --- REGEX MINING (Busca Inteligente) ---

                                // 1. Busca Telefone: (xx) xxxxx-xxxx ou variações
                                const telMatch = textBody.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
                                if (telMatch) telefone = telMatch[0].trim();

                                // 2. Busca Valor: R$ xx,xx
                                const valMatch = textBody.match(/R\$\s?[\d.,]+/);
                                if (valMatch) valor = valMatch[0].trim();

                                // 3. Busca Cliente: Procura rótulos como "Cliente:" ou "Nome:"
                                const clienteMatch = textBody.match(/(?:Cliente|Nome)\s*[:;-]\s*([^.,;]+)/i);
                                if (clienteMatch && clienteMatch[1]) {
                                    cliente = this.cleanText(clienteMatch[1]).substring(0, 40); // Limita tamanho
                                } else {
                                    // Fallback: Se não achou no texto, tenta extrair partes do nome do arquivo
                                    // Ex: "1050 - João Silva - HP.docx" -> Pega "João Silva"
                                    const parts = file.replace('.docx', '').split('-');
                                    if (parts.length > 1) {
                                        const possivelNome = parts[1].trim();
                                        // Evita pegar números ou strings vazias
                                        if (isNaN(parseInt(possivelNome)) && possivelNome.length > 2) {
                                            cliente = possivelNome;
                                        }
                                    }
                                }

                                // 4. Busca Equipamento: Procura "Modelo" ou "Equipamento"
                                const equipMatch = textBody.match(/(?:Equipamento|Aparelho|Modelo)\s*[:;-]\s*([^.,;]+)/i);
                                if (equipMatch && equipMatch[1]) {
                                    impressora = this.cleanText(equipMatch[1]).substring(0, 30);
                                }
                            }
                        } catch (err) {
                            // Se o arquivo estiver corrompido ou aberto, não quebra o loop, apenas usa os dados padrão
                            console.warn(`[SCAN] Falha ao ler conteúdo de ${file}`);
                        }

                        recovered.push({
                            os: id,
                            data: dataArquivo,
                            cliente: cliente,
                            impressora: impressora,
                            status: file.toLowerCase().includes('entregue') ? 'Aprovado - Entregue' : 'Em Análise',
                            valor,
                            telefone,
                            orcamento: defeito,
                            obs
                        });
                    }
                }
            }

            // --- LÓGICA DE UNICIDADE INTELIGENTE ---
            // Se houver dois arquivos para a mesma OS (ex: cópia de segurança), mantém o melhor registro
            const uniqueMap = new Map();

            recovered.forEach(item => {
                if (!uniqueMap.has(item.os)) {
                    uniqueMap.set(item.os, item);
                } else {
                    const existing = uniqueMap.get(item.os);
                    // Prioriza o registro que conseguiu identificar o nome do cliente
                    if (existing.cliente === "Cliente não identificado" && item.cliente !== "Cliente não identificado") {
                        uniqueMap.set(item.os, item);
                    }
                }
            });

            // Ordena e gera array final
            const uniqueRecovered = Array.from(uniqueMap.values()).sort((a: any, b: any) => a.os - b.os);

            console.log(`[SCAN] Concluído. ${uniqueRecovered.length} arquivos processados com sucesso.`);
            return { success: true, data: { ultimo_numero: maxId, historico: uniqueRecovered } };

        } catch (e) {
            console.error("[SCAN] Erro fatal durante varredura:", e);
            return { success: false, error: String(e) };
        }
    }
}