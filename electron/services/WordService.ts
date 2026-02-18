import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

interface WordServiceData {
    os: string | number;
    cliente: string;
    impressora: string;
    status: string;
    [key: string]: any;
}

interface GenerateResult {
    success: boolean;
    path?: string;
    error?: string;
}

export class WordService {
    private modeloPath: string;
    private outputDir: string;

    constructor(modeloPath: string, outputDir: string) {
        this.modeloPath = modeloPath;
        this.outputDir = outputDir;
        this.ensureDir();
    }

    private ensureDir(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private generateDeterministicFilename(osId: string | number): string {
        return `OS-${osId}.docx`;
    }

    private getFilePath(osId: string | number): string {
        const filename = this.generateDeterministicFilename(osId);
        return path.join(this.outputDir, filename);
    }

    /**
     * Verifica se já existe arquivo para esta OS (independente do status)
     */
    private async checkExistingFile(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    public async generate(data: WordServiceData): Promise<GenerateResult> {
        const osId = data.os;
        console.log(`[DOCX] Processando OS #${osId} (status: ${data.status})...`);

        try {
            // Validação do modelo
            if (!fs.existsSync(this.modeloPath)) {
                return {
                    success: false,
                    error: `Arquivo modelo não encontrado: ${this.modeloPath}`
                };
            }

            // Leitura e processamento do template
            const content = await fs.promises.readFile(this.modeloPath, 'binary');

            let zip: PizZip;
            try {
                zip = new PizZip(content);
            } catch (e) {
                return {
                    success: false,
                    error: "Arquivo modelo corrompido ou em formato inválido"
                };
            }

            const doc = new Docxtemplater(zip, {
                paragraphLoop: false,
                linebreaks: true
            });

            // Prepara dados para renderização
            const renderData: Record<string, string> = {};
            for (const [key, value] of Object.entries(data)) {
                renderData[key.toUpperCase()] = String(value ?? '');
            }

            // Renderização do documento
            try {
                doc.render(renderData);
            } catch (err: any) {
                const errors = err.properties?.errors?.map((e: any) => e.properties.explanation).join(' | ');
                console.error(`[DOCX] Erro de renderização OS #${osId}:`, errors || err);
                return {
                    success: false,
                    error: `Erro nas tags do template: ${errors || err.message}`
                };
            }

            // Determina caminho do arquivo (sempre o mesmo para esta OS)
            const filePath = this.getFilePath(data.os);

            // Verifica se já existe (apenas para logging)
            const existingFile = await this.checkExistingFile(filePath);
            if (existingFile) {
                console.log(`[DOCX] Atualizando arquivo existente para OS #${osId}`);
            } else {
                console.log(`[DOCX] Criando novo arquivo para OS #${osId}`);
            }

            // Geração e escrita do arquivo (sobrescreve se existir)
            const buffer = doc.getZip().generate({ type: 'nodebuffer' });
            await fs.promises.writeFile(filePath, buffer);

            console.log(`[DOCX] Sucesso OS #${osId}: ${filePath}`);
            return { success: true, path: filePath };

        } catch (e: any) {
            console.error(`[DOCX] Erro fatal OS #${osId}:`, e);
            return {
                success: false,
                error: `Erro interno: ${e.message || e}`
            };
        }
    }
}
