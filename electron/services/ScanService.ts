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

    public async scanFiles(): Promise<{ success: boolean; data?: { ultimo_numero: number; historico: RecoveredItem[] }; error?: string }> {
        console.log("[SCAN] Iniciando varredura inteligente...");
        try {
            if (!fs.existsSync(this.outputDir)) return { success: false, data: { ultimo_numero: 0, historico: [] } };

            const files = await fs.promises.readdir(this.outputDir);
            const recovered: RecoveredItem[] = [];
            let maxId = 3825; // Começa do padrão se não achar nada

            // Regex poderosa para achar IDs no início do arquivo
            const idRegex = /^(?:O\.?S\.?|Nº?|PEDIDO)?\s*[.\-_]?\s*(\d{3,6})/i;

            const docxFiles = files.filter(f => f.endsWith('.docx'));

            // Limita a leitura profunda (abrir o Word) aos últimos 100 arquivos para performance
            const recentFilesLimit = 100;
            const startIndex = Math.max(0, docxFiles.length - recentFilesLimit);

            for (let i = 0; i < docxFiles.length; i++) {
                const file = docxFiles[i];

                // 1. Extrai ID pelo nome
                const match = file.match(idRegex);

                if (match && match[1]) {
                    const id = parseInt(match[1]);

                    if (!isNaN(id) && id > 0) {
                        if (id > maxId) maxId = id;

                        const stats = await fs.promises.stat(path.join(this.outputDir, file));

                        // 2. Tenta adivinhar Cliente e Máquina pelo nome do arquivo
                        let cleanName = file.replace('.docx', '').replace(match[0], '').trim();
                        cleanName = cleanName.replace(/^[\s\-_/]+/, ''); // Remove traços do início

                        const parts = cleanName.split(/[\-/]/).map(s => s.trim()).filter(s => s.length > 0);

                        let cliente = parts[0] || "Desconhecido";
                        let impressora = parts[1] || "Geral";

                        let valor = "R$ 0,00";
                        let telefone = "";
                        let obs = "Recuperado pelo nome do arquivo";

                        // 3. Leitura Profunda (apenas nos recentes)
                        if (i >= startIndex) {
                            try {
                                const content = await fs.promises.readFile(path.join(this.outputDir, file), 'binary');
                                const zip = new PizZip(content);
                                if (zip.files['word/document.xml']) {
                                    const txt = zip.files['word/document.xml'].asText().replace(/<[^>]+>/g, ' ');

                                    // Busca valores monetários no texto
                                    const vMatch = txt.match(/R\$\s?[\d.,]+/);
                                    // Busca telefones no texto
                                    const tMatch = txt.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);

                                    if (vMatch) valor = vMatch[0];
                                    if (tMatch) telefone = tMatch[0];
                                    obs = "Recuperado com leitura interna (Sincronizado)";
                                }
                            } catch (e) { /* Ignora erro de leitura interna */ }
                        }

                        recovered.push({
                            os: id,
                            data: stats.birthtime.toLocaleDateString('pt-BR'),
                            cliente: cliente,
                            impressora: impressora,
                            status: file.toLowerCase().includes('entregue') ? 'Entregue' : 'Em Análise',
                            valor, telefone,
                            orcamento: "Recuperado",
                            obs
                        });
                    }
                }
            }

            // Remove duplicados (mantendo o mais recente) e ordena
            const uniqueMap = new Map();
            recovered.forEach(item => uniqueMap.set(item.os, item));
            const uniqueRecovered = Array.from(uniqueMap.values()).sort((a: any, b: any) => a.os - b.os);

            console.log(`[SCAN] Concluído. ${uniqueRecovered.length} arquivos processados.`);
            return { success: true, data: { ultimo_numero: maxId, historico: uniqueRecovered } };

        } catch (e) {
            console.error("[SCAN] Erro fatal:", e);
            return { success: false, error: String(e) };
        }
    }
}