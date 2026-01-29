"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
let mainWindow = null;
// --- DEFINIÇÃO INTELIGENTE DE CAMINHOS ---
const BASE_PATH = electron_is_dev_1.default
    ? path_1.default.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path_1.default.dirname(process.execPath));
const DB_PATH = path_1.default.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path_1.default.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path_1.default.join(BASE_PATH, 'Backups');
const MODELO_PATH = electron_is_dev_1.default
    ? path_1.default.join(__dirname, '../modelo_os.docx')
    : path_1.default.join(process.resourcesPath, 'modelo_os.docx');
// Garante que as pastas de saída existam
[OUTPUT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
});
// --- BACKUP AUTOMÁTICO ---
function performBackup() {
    try {
        if (fs_1.default.existsSync(DB_PATH)) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupPath = path_1.default.join(BACKUP_DIR, `backup_${timestamp}.json`);
            fs_1.default.copyFileSync(DB_PATH, backupPath);
            // Mantém apenas os últimos 50 backups para não encher o disco
            const files = fs_1.default.readdirSync(BACKUP_DIR);
            if (files.length > 50) {
                files.sort();
                files.slice(0, files.length - 50).forEach(f => fs_1.default.unlinkSync(path_1.default.join(BACKUP_DIR, f)));
            }
        }
    }
    catch (error) {
        console.error("Erro no Backup:", error);
    }
}
function createWindow() {
    performBackup();
    mainWindow = new electron_1.BrowserWindow({
        width: 1280, height: 800, title: "Cap.Com System",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: path_1.default.join(__dirname, '../public/favicon.ico')
    });
    const startURL = electron_is_dev_1.default ? 'http://localhost:5173' : `file://${path_1.default.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startURL);
}
// --- HANDLERS (PROCESSOS) ---
// 1. Carregar Banco
electron_1.ipcMain.handle('db-load', async () => {
    try {
        if (fs_1.default.existsSync(DB_PATH)) {
            const data = await fs_1.default.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (e) {
        console.error(e);
    }
    return { ultimo_numero: 3825, historico: [] };
});
// 2. Salvar Banco
electron_1.ipcMain.handle('db-save', async (event, data) => {
    try {
        await fs_1.default.promises.writeFile(DB_PATH, JSON.stringify(data, null, 4), 'utf-8');
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
// 3. Gerar DOCX (CORREÇÃO DE TRAVAMENTO AQUI)
electron_1.ipcMain.handle('generate-docx', async (event, data) => {
    console.log(`[DOCX] Iniciando geração para OS #${data.os}...`);
    try {
        if (!fs_1.default.existsSync(MODELO_PATH))
            return { success: false, error: "Modelo 'modelo_os.docx' não encontrado." };
        const content = await fs_1.default.promises.readFile(MODELO_PATH, 'binary');
        let zip;
        try {
            zip = new pizzip_1.default(content);
        }
        catch (e) {
            return { success: false, error: "Arquivo modelo corrompido ou inválido." };
        }
        // --- MUDANÇA CRÍTICA: paragraphLoop: false evita loops infinitos ---
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: false,
            linebreaks: true
        });
        const renderData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v || '')]));
        try {
            doc.render(renderData);
        }
        catch (err) {
            const errors = err.properties?.errors?.map((e) => e.properties.explanation).join(' | ');
            console.error("[DOCX] Erro de renderização:", errors || err);
            return { success: false, error: `Erro nas tags do Word: ${errors || err.message}` };
        }
        const safeName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path_1.default.join(OUTPUT_DIR, safeName);
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        await fs_1.default.promises.writeFile(filePath, buffer);
        console.log(`[DOCX] Sucesso: ${filePath}`);
        return { success: true, path: filePath };
    }
    catch (e) {
        console.error("[DOCX] Erro fatal:", e);
        return { success: false, error: String(e.message || e) };
    }
});
// 4. Scan Inteligente (OTIMIZADO PARA NÃO TRAVAR)
electron_1.ipcMain.handle('scan-files', async () => {
    console.log("[SCAN] Iniciando varredura...");
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: false, count: 0 };
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
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
                    if (id > maxId)
                        maxId = id;
                    const stats = await fs_1.default.promises.stat(path_1.default.join(OUTPUT_DIR, file));
                    let valor = "R$ 0,00";
                    let telefone = "";
                    let obs = "Recuperado pelo nome";
                    // Só lê o conteúdo interno (pesado) se for um arquivo recente
                    if (i >= startIndex) {
                        try {
                            const content = await fs_1.default.promises.readFile(path_1.default.join(OUTPUT_DIR, file), 'binary');
                            const zip = new pizzip_1.default(content);
                            if (zip.files['word/document.xml']) {
                                const txt = zip.files['word/document.xml'].asText().replace(/<[^>]+>/g, ' ');
                                const vMatch = txt.match(/R\$\s?[\d.,]+/);
                                const tMatch = txt.match(/\(\d{2}\)\s?\d{4,5}-?\d{4}/);
                                if (vMatch)
                                    valor = vMatch[0];
                                if (tMatch)
                                    telefone = tMatch[0];
                                obs = "Sincronizado Completo";
                            }
                        }
                        catch (e) { /* Ignora erro de leitura interna */ }
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
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
// 5. Deletar Arquivo
electron_1.ipcMain.handle('delete-os-file', async (event, osId) => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: true };
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file)
            await fs_1.default.promises.unlink(path_1.default.join(OUTPUT_DIR, file));
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
// --- SISTEMA ---
electron_1.ipcMain.handle('open-folder', async (event, type) => {
    try {
        const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
        if (!fs_1.default.existsSync(target))
            await fs_1.default.promises.mkdir(target, { recursive: true });
        await electron_1.shell.openPath(target);
    }
    catch (e) {
        console.error("[FOLDER] Erro:", e);
    }
});
electron_1.ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            await electron_1.shell.openPath(path_1.default.join(OUTPUT_DIR, file));
            return { success: true };
        }
        return { success: false, error: 'Arquivo não encontrado.' };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => electron_1.app.quit());
