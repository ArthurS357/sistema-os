import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export class WordService {
    private modeloPath: string;
    private outputDir: string;

    constructor(modeloPath: string, outputDir: string) {
        this.modeloPath = modeloPath;
        this.outputDir = outputDir;
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    public async generate(data: any): Promise<{ success: boolean; path?: string; error?: string }> {
        console.log(`[DOCX] Iniciando geração para OS #${data.os}...`);

        try {
            if (!fs.existsSync(this.modeloPath)) {
                return { success: false, error: "Arquivo 'modelo_os.docx' não encontrado." };
            }

            const content = await fs.promises.readFile(this.modeloPath, 'binary');

            let zip;
            try {
                zip = new PizZip(content);
            } catch (e) {
                return { success: false, error: "Arquivo modelo corrompido ou inválido." };
            }

            const doc = new Docxtemplater(zip, {
                paragraphLoop: false,
                linebreaks: true
            });

            // Normaliza os dados para o template (chaves em MAIÚSCULO)
            const renderData = Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v || '')])
            );

            try {
                doc.render(renderData);
            } catch (err: any) {
                const errors = err.properties?.errors?.map((e: any) => e.properties.explanation).join(' | ');
                console.error("[DOCX] Erro de renderização:", errors || err);
                return { success: false, error: `Erro nas tags do Word: ${errors || err.message}` };
            }

            // Gera nome seguro para o arquivo
            const safeName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`
                .replace(/[<>:"/\\|?*]/g, '-')
                .trim() + ".docx";

            const filePath = path.join(this.outputDir, safeName);
            const buffer = doc.getZip().generate({ type: 'nodebuffer' });

            await fs.promises.writeFile(filePath, buffer);
            console.log(`[DOCX] Sucesso: ${filePath}`);

            return { success: true, path: filePath };

        } catch (e: any) {
            console.error("[DOCX] Erro fatal:", e);
            return { success: false, error: String(e.message || e) };
        }
    }
}