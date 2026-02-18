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

interface ScanResult {
    success: boolean;
    data?: { ultimo_numero: number; historico: RecoveredItem[] };
    error?: string;
}

export class ScanService {
    private outputDir: string;
    private readonly CONCURRENCY_LIMIT = 10;
    private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
    private processedCount = 0;

    constructor(outputDir: string) {
        this.outputDir = outputDir;
    }

    private cleanText(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    private extractOsIdFromFilename(filename: string): number | null {
        const match = filename.match(/^(\d{1,6})/);
        if (!match) return null;

        const id = parseInt(match[1]);
        return id > 0 && id < 1000000 ? id : null;
    }

    private parseDocumentXml(xmlContent: string): {
        telefone: string;
        valor: string;
        cliente: string;
        impressora: string;
    } {
        const cleanText = xmlContent
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const telefone = this.extractTelephone(cleanText);
        const valor = this.extractValue(cleanText);
        const cliente = this.extractField(cleanText, ['cliente', 'nome'], 'cliente', 40);
        const impressora = this.extractField(cleanText, ['equipamento', 'modelo', 'impressora'], 'impressora', 30);

        return { telefone, valor, cliente, impressora };
    }

    private extractTelephone(text: string): string {
        const match = text.match(/(?:\btelefone|tel|fone\b\s*[:;-]?\s*)?(\(\d{2}\)\s?\d{4,5}[-\s]?\d{4})/i);
        return match ? match[1].trim() : '';
    }

    private extractValue(text: string): string {
        const match = text.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
        return match ? `R$ ${match[1]}` : 'R$ 0,00';
    }

    private extractField(text: string, keywords: string[], fieldType: 'cliente' | 'impressora', maxLength: number): string {
        for (const keyword of keywords) {
            const regex = new RegExp(`(?:${keyword})\\s*[:;-]\\s*([^.,;]+)`, 'i');
            const match = text.match(regex);
            if (match && match[1]) {
                const cleaned = this.cleanText(match[1]).substring(0, maxLength);
                if (cleaned.length > 2) return cleaned;
            }
        }
        return fieldType === 'cliente' ? 'Cliente não identificado' : 'Equipamento antigo';
    }

    private async extractInfoFromFile(filePath: string, osId: number): Promise<RecoveredItem | null> {
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.size > this.MAX_FILE_SIZE) {
                return null;
            }

            // Usar mtime que é mais confiável cross-platform
            const dataArquivo = stats.mtime.toLocaleDateString('pt-BR');
            const fileName = path.basename(filePath);

            const fallbackItem: RecoveredItem = {
                os: osId,
                data: dataArquivo,
                cliente: "Cliente não identificado",
                impressora: "Equipamento antigo",
                status: fileName.toLowerCase().includes('entregue') ? 'Aprovado - Entregue' : 'Em Análise',
                valor: "R$ 0,00",
                telefone: "",
                orcamento: "Verificar arquivo físico",
                obs: "Sincronizado do arquivo"
            };

            try {
                const buffer = await fs.promises.readFile(filePath);
                const zip = new PizZip(buffer);

                const xmlFile = zip.files['word/document.xml'];
                if (!xmlFile) return fallbackItem;

                const xmlContent = xmlFile.asText();
                const extracted = this.parseDocumentXml(xmlContent);

                return {
                    ...fallbackItem,
                    cliente: extracted.cliente || fallbackItem.cliente,
                    impressora: extracted.impressora || fallbackItem.impressora,
                    telefone: extracted.telefone,
                    valor: extracted.valor
                };

            } catch {
                return fallbackItem;
            }

        } catch (e) {
            return null;
        }
    }

    private async processWithConcurrency<T, R>(
        items: T[],
        processFn: (item: T) => Promise<R>,
        concurrency: number = this.CONCURRENCY_LIMIT
    ): Promise<R[]> {
        const results: R[] = [];
        const pending = new Set<Promise<void>>();
        const totalItems = items.length;

        for (const item of items) {
            if (pending.size >= concurrency) {
                await Promise.race(pending);
            }

            const promise = processFn(item)
                .then(result => {
                    this.processedCount++;
                    // Log progressivo a cada 50 arquivos para evitar gargalo
                    if (this.processedCount % 50 === 0) {
                        console.log(`[SCAN] Progresso: ${this.processedCount}/${totalItems} arquivos processados`);
                    }
                    results.push(result);
                })
                .catch(error => {
                    console.warn(`[SCAN] Erro processando item:`, error);
                    // Adiciona resultado vazio ou marcador de erro se necessário
                })
                .finally(() => {
                    pending.delete(promise);
                });

            pending.add(promise);
        }

        await Promise.all(pending);
        return results;
    }

    public async scanFiles(): Promise<ScanResult> {
        console.log("[SCAN] Iniciando varredura otimizada...");
        const startTime = Date.now();
        this.processedCount = 0; // Reset counter

        try {
            if (!fs.existsSync(this.outputDir)) {
                return { success: true, data: { ultimo_numero: 0, historico: [] } };
            }

            const files = await fs.promises.readdir(this.outputDir);
            const docxFiles = files.filter(f =>
                f.endsWith('.docx') &&
                !f.startsWith('~$') &&
                !f.includes('temp')
            );

            console.log(`[SCAN] ${docxFiles.length} arquivos .docx encontrados`);

            const validFiles = docxFiles
                .map(file => ({ file, osId: this.extractOsIdFromFilename(file) }))
                .filter((item): item is { file: string; osId: number } => item.osId !== null);

            console.log(`[SCAN] ${validFiles.length} arquivos com ID válido`);

            const processFile = async (item: { file: string; osId: number }) => {
                const filePath = path.join(this.outputDir, item.file);
                const result = await this.extractInfoFromFile(filePath, item.osId);
                return { file: item.file, item: result };
            };

            const batchResults = await this.processWithConcurrency(
                validFiles,
                processFile,
                Math.min(this.CONCURRENCY_LIMIT, validFiles.length)
            );

            const validItems = batchResults
                .filter((result): result is { file: string; item: RecoveredItem } => result.item !== null)
                .map(result => result.item);

            const itemMap = new Map<number, RecoveredItem>();
            let maxId = 0;

            for (const item of validItems) {
                if (item.os > maxId) maxId = item.os;

                const existing = itemMap.get(item.os);
                if (!existing || existing.cliente.includes("não identificado")) {
                    itemMap.set(item.os, item);
                }
            }

            const historico = Array.from(itemMap.values()).sort((a, b) => a.os - b.os);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`[SCAN] Concluído em ${duration}s: ${historico.length} OSs recuperadas`);

            return {
                success: true,
                data: {
                    ultimo_numero: maxId,
                    historico
                }
            };

        } catch (e: any) {
            console.error("[SCAN] Erro fatal:", e);
            return { success: false, error: e.message };
        }
    }

    public async syncSingleFile(osId: number): Promise<{ success: boolean; data?: RecoveredItem; error?: string }> {
        try {
            const files = await fs.promises.readdir(this.outputDir);

            const targetFile = files.find(f => {
                if (!f.endsWith('.docx') || f.startsWith('~$')) return false;
                const fileOsId = this.extractOsIdFromFilename(f);
                return fileOsId === osId;
            });

            if (!targetFile) {
                return { success: false, error: "Arquivo físico não encontrado." };
            }

            const filePath = path.join(this.outputDir, targetFile);
            const recoveredData = await this.extractInfoFromFile(filePath, osId);

            return recoveredData
                ? { success: true, data: recoveredData }
                : { success: false, error: "Falha ao ler o arquivo." };

        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
