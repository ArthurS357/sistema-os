import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Interfaces com tipagem forte
interface WordServiceData {
    os: string | number;
    cliente: string;
    impressora: string;
    status: string;
    [key: string]: unknown; // Mais seguro que 'any'
}

interface GenerateResult {
    success: boolean;
    path?: string;
    error?: string;
}

interface DocxtemplaterError extends Error {
    properties?: {
        errors?: Array<{
            properties: {
                explanation: string;
            };
        }>;
    };
}

export class WordService {
    private modeloPath: string;
    private outputDir: string;

    constructor(modeloPath: string, outputDir: string) {
        this.modeloPath = modeloPath;
        this.outputDir = outputDir;
    }

    private async ensureDir(): Promise<void> {
        try {
            await fs.promises.access(this.outputDir);
        } catch {
            await fs.promises.mkdir(this.outputDir, { recursive: true });
        }
    }

    private generateDeterministicFilename(osId: string | number): string {
        const safeId = String(osId).replace(/[<>:"/\\|?*]/g, '-');
        return `OS-${safeId}.docx`;
    }

    private getFilePath(osId: string | number): string {
        const filename = this.generateDeterministicFilename(osId);
        return path.join(this.outputDir, filename);
    }

    /**
     * Remove arquivos antigos para evitar duplicação
     */
    private async cleanupLegacyFiles(osId: string | number): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.outputDir);
            const newFilename = this.generateDeterministicFilename(osId);
            
            // Regex segura com escape do ID
            const escapedOsId = String(osId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const legacyRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${escapedOsId}[\\s.\\-_]`, 'i');

            const legacyFiles = files.filter(file => 
                legacyRegex.test(file) && 
                file !== newFilename && 
                file.endsWith('.docx') &&
                !file.startsWith('~$') // Ignora arquivos temporários do Word
            );

            if (legacyFiles.length > 0) {
                const deletePromises = legacyFiles.map(async (legacyFile) => {
                    const filePath = path.join(this.outputDir, legacyFile);
                    try {
                        await fs.promises.unlink(filePath);
                        console.log(`[DOCX] Arquivo legado removido: ${legacyFile}`);
                    } catch (deleteError) {
                        console.warn(`[DOCX] Não foi possível remover ${legacyFile}:`, deleteError);
                    }
                });
                
                await Promise.allSettled(deletePromises);
            }
        } catch (error) {
            console.warn(`[DOCX] Aviso: Não foi possível limpar arquivos legados para OS #${osId}`, error);
        }
    }

    /**
     * Valida dados de entrada antes do processamento
     */
    private validateData(data: WordServiceData): { isValid: boolean; error?: string } {
        if (!data.os || String(data.os).trim() === '') {
            return { isValid: false, error: 'Número da OS é obrigatório' };
        }
        
        if (typeof data.os !== 'string' && typeof data.os !== 'number') {
            return { isValid: false, error: 'Número da OS deve ser string ou número' };
        }
        
        const osId = Number(data.os);
        if (isNaN(osId) || osId <= 0 || osId >= 1000000) {
            return { isValid: false, error: 'Número da OS deve ser um número válido' };
        }

        return { isValid: true };
    }

    /**
     * Cria dados de renderização com tipagem segura
     */
    private createRenderData(data: WordServiceData): Record<string, string> {
        const renderData: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(data)) {
            // Filtra apenas valores primitivos para evitar problemas no template
            if (value !== null && value !== undefined) {
                renderData[key.toUpperCase()] = String(value);
            } else {
                renderData[key.toUpperCase()] = '';
            }
        }
        
        return renderData;
    }

    public async generate(data: WordServiceData): Promise<GenerateResult> {
        const osId = data.os;
        console.log(`[DOCX] Processando OS #${osId} (status: ${data.status})...`);

        try {
            // Validação de dados
            const validation = this.validateData(data);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Garante que a pasta existe
            await this.ensureDir();

            // Verificação assíncrona do arquivo modelo
            try {
                await fs.promises.access(this.modeloPath);
            } catch {
                return {
                    success: false,
                    error: `Arquivo modelo não encontrado: ${this.modeloPath}`
                };
            }

            const content = await fs.promises.readFile(this.modeloPath, 'binary');

            let zip: PizZip;
            try {
                zip = new PizZip(content);
            } catch (error) {
                console.error(`[DOCX] Erro ao carregar modelo para OS #${osId}:`, error);
                return {
                    success: false,
                    error: "Arquivo modelo corrompido ou em formato inválido"
                };
            }

            const doc = new Docxtemplater(zip, {
                paragraphLoop: false,
                linebreaks: true
            });

            const renderData = this.createRenderData(data);

            try {
                doc.render(renderData);
            } catch (error: unknown) {
                const err = error as DocxtemplaterError;
                const errors = err.properties?.errors?.map(e => e.properties.explanation).join(' | ');
                const errorMessage = errors || (err instanceof Error ? err.message : 'Erro desconhecido');
                
                console.error(`[DOCX] Erro de renderização OS #${osId}:`, errorMessage);
                return {
                    success: false,
                    error: `Erro nas tags do template: ${errorMessage}`
                };
            }

            // Limpa arquivos legados antes de salvar
            await this.cleanupLegacyFiles(osId);

            const filePath = this.getFilePath(osId);
            const buffer = doc.getZip().generate({ type: 'nodebuffer' });
            
            // Escrita atômica do arquivo
            await fs.promises.writeFile(filePath, buffer);

            // Verificação final para garantir que o arquivo foi criado
            try {
                await fs.promises.access(filePath);
                console.log(`[DOCX] Sucesso OS #${osId}: ${filePath}`);
                return { success: true, path: filePath };
            } catch (accessError) {
                console.error(`[DOCX] Erro de verificação OS #${osId}:`, accessError);
                return {
                    success: false,
                    error: 'Arquivo gerado mas não pôde ser verificado'
                };
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            console.error(`[DOCX] Erro fatal OS #${osId}:`, errorMessage);
            return {
                success: false,
                error: `Erro interno: ${errorMessage}`
            };
        }
    }

    /**
     * Método auxiliar para verificar se um arquivo de OS existe
     */
    public async fileExists(osId: string | number): Promise<boolean> {
        try {
            const filePath = this.getFilePath(osId);
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Método para obter o caminho do arquivo sem verificação
     */
    public getFileLocation(osId: string | number): string {
        return this.getFilePath(osId);
    }
}
