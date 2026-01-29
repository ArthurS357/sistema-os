import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

// --- DEFINIÇÃO INTELIGENTE DE CAMINHOS ---
const BASE_PATH = isDev
    ? path.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath));

const DB_PATH = path.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path.join(BASE_PATH, 'Backups');

const MODELO_PATH = isDev
    ? path.join(__dirname, '../modelo_os.docx')
    : path.join(process.resourcesPath, 'modelo_os.docx');

// Garante que as pastas de saída existam
[OUTPUT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- BACKUP AUTOMÁTICO ---
function performBackup() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
            fs.copyFileSync(DB_PATH, backupPath);

            // Mantém apenas os últimos 50 backups para não encher o disco
            const files = fs.readdirSync(BACKUP_DIR);
            if (files.length > 50) {
                files.sort();
                files.slice(0, files.length - 50).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
            }
        }
    } catch (error) { console.error("Erro no Backup:", error); }
}

function createWindow(): void {
    performBackup();
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, title: "Cap.Com System",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../public/favicon.ico')
    });

    const startURL = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startURL);
}

// --- HANDLERS (PROCESSOS) ---

// 1. Carregar Banco
ipcMain.handle('db-load', async () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = await fs.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) { console.error(e); }
    return { ultimo_numero: 3825, historico: [] };
});

// 2. Salvar Banco
ipcMain.handle('db-save', async (event, data) => {
    try {
        await fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 4), 'utf-8');
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
});

// 3. Gerar DOCX (CORREÇÃO DE TRAVAMENTO AQUI)
ipcMain.handle('generate-docx', async (event, data) => {
    console.log(`[DOCX] Iniciando geração para OS #${data.os}...`);
    try {
        if (!fs.existsSync(MODELO_PATH)) return { success: false, error: "Modelo 'modelo_os.docx' não encontrado." };

        const content = await fs.promises.readFile(MODELO_PATH, 'binary');

        let zip;
        try {
            zip = new PizZip(content);
        } catch (e) {
            return { success: false, error: "Arquivo modelo corrompido ou inválido." };
        }

        // --- MUDANÇA CRÍTICA: paragraphLoop: false evita loops infinitos ---
        const doc = new Docxtemplater(zip, {
            paragraphLoop: false,
            linebreaks: true
        });

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

        const safeName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path.join(OUTPUT_DIR, safeName);

        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        await fs.promises.writeFile(filePath, buffer);

        console.log(`[DOCX] Sucesso: ${filePath}`);
        return { success: true, path: filePath };
    } catch (e: any) {
        console.error("[DOCX] Erro fatal:", e);
        return { success: false, error: String(e.message || e) };
    }
});

// 4. Scan Inteligente (OTIMIZADO PARA NÃO TRAVAR)
ipcMain.handle('scan-files', async () => {
    console.log("[SCAN] Iniciando varredura...");
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, count: 0 };

        const files = await fs.promises.readdir(OUTPUT_DIR);
        const recovered = [];
        let maxId = 3825;

        // Filtra apenas arquivos .docx válidos
        const docxFiles = files.filter(f => f.endsWith('.docx'));

        // OTIMIZAÇÃO: Limita a leitura profunda aos últimos 100 arquivos para performance
        // (Arquivos mais antigos são recuperados apenas pelo nome)
        const recentFilesLimit = 100;
        const startIndex = Math.max(0, docxFiles.length - recentFilesLimit);

        // Processa arquivos
        for (let i = 0; i < docxFiles.length; i++) {
            const file = docxFiles[i];
            const parts = file.replace('.docx', '').split(' - ');

            if (parts.length >= 2) {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) {
                    if (id > maxId) maxId = id;

                    const stats = await fs.promises.stat(path.join(OUTPUT_DIR, file));
                    let valor = "R$ 0,00";
                    let telefone = "";
                    let obs = "Recuperado pelo nome";

                    // Só lê o conteúdo interno (pesado) se for um arquivo recente
                    if (i >= startIndex) {
                        try {
                            const content = await fs.promises.readFile(path.join(OUTPUT_DIR, file), 'binary');
                            const zip = new PizZip(content);
                            if (zip.files['word/document.xml']) {
                                const txt = zip.files['word/document.xml'].asText().replace(/<[^>]+>/g, ' ');
                                const vMatch = txt.match(/R\$\s?[\d.,]+/);
                                const tMatch = txt.match(/\(\d{2}\)\s?\d{4,5}-?\d{4}/);
                                if (vMatch) valor = vMatch[0];
                                if (tMatch) telefone = tMatch[0];
                                obs = "Sincronizado Completo";
                            }
                        } catch (e) { /* Ignora erro de leitura interna */ }
                    }

                    recovered.push({
                        os: id,
                        data: stats.birthtime.toLocaleDateString('pt-BR'),
                        cliente: parts[1] || "?",
                        impressora: parts[2] || "?",
                        status: parts[3] || "Em Análise",
                        valor, telefone,
                        orcamento: "Recuperado",
                        obs
                    });
                }
            }
        }

        recovered.sort((a, b) => a.os - b.os);
        console.log(`[SCAN] Concluído. ${recovered.length} arquivos processados.`);
        return { success: true, data: { ultimo_numero: maxId, historico: recovered } };
    } catch (e) { return { success: false, error: String(e) }; }
});

// 5. Deletar Arquivo
ipcMain.handle('delete-os-file', async (event, osId) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: true };
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) await fs.promises.unlink(path.join(OUTPUT_DIR, file));
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
});

// --- SISTEMA ---
ipcMain.handle('open-folder', async (event, type) => {
    try {
        const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
        if (!fs.existsSync(target)) await fs.promises.mkdir(target, { recursive: true });
        await shell.openPath(target);
    } catch (e) { console.error("[FOLDER] Erro:", e); }
});

ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            await shell.openPath(path.join(OUTPUT_DIR, file));
            return { success: true };
        }
        return { success: false, error: 'Arquivo não encontrado.' };
    } catch (e) { return { success: false, error: String(e) }; }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());