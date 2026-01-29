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
// Se estiver desenvolvendo (isDev): usa a pasta do projeto.
// Se for Produção (Executável): usa a pasta onde o .exe está rodando.
const BASE_PATH = electron_is_dev_1.default
    ? path_1.default.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path_1.default.dirname(process.execPath));
const DB_PATH = path_1.default.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path_1.default.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path_1.default.join(BASE_PATH, 'Backups');
// Caminho do modelo Word
const MODELO_PATH = electron_is_dev_1.default
    ? path_1.default.join(__dirname, '../modelo_os.docx')
    : path_1.default.join(process.resourcesPath, 'modelo_os.docx');
// Garante que as pastas de saída existam
[OUTPUT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
});
// --- FUNÇÃO DE BACKUP AUTOMÁTICO ---
function performBackup() {
    try {
        if (fs_1.default.existsSync(DB_PATH)) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupName = `backup_${timestamp}.json`;
            const backupPath = path_1.default.join(BACKUP_DIR, backupName);
            fs_1.default.copyFileSync(DB_PATH, backupPath);
            console.log(`Backup criado: ${backupName}`);
            // Limpeza: Mantém apenas os últimos 50 backups
            const files = fs_1.default.readdirSync(BACKUP_DIR);
            if (files.length > 50) {
                files.sort();
                const toDelete = files.slice(0, files.length - 50);
                toDelete.forEach(f => fs_1.default.unlinkSync(path_1.default.join(BACKUP_DIR, f)));
            }
        }
    }
    catch (error) {
        console.error("Erro ao criar backup:", error);
    }
}
function createWindow() {
    performBackup(); // Backup ao iniciar
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        title: "Cap.Com System",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: path_1.default.join(__dirname, '../public/favicon.ico')
    });
    const startURL = electron_is_dev_1.default
        ? 'http://localhost:5173'
        : `file://${path_1.default.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startURL);
    mainWindow.maximize();
    mainWindow.on('closed', () => { mainWindow = null; });
}
// --- COMANDOS DO SISTEMA ---
// 1. Carregar Banco de Dados
electron_1.ipcMain.handle('db-load', async () => {
    try {
        if (fs_1.default.existsSync(DB_PATH)) {
            const data = await fs_1.default.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error(error);
    }
    return { ultimo_numero: 3825, historico: [] };
});
// 2. Salvar Banco de Dados
electron_1.ipcMain.handle('db-save', async (event, data) => {
    try {
        const jsonContent = JSON.stringify(data, null, 4);
        await fs_1.default.promises.writeFile(DB_PATH, jsonContent, 'utf-8');
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// 3. Gerar Arquivo Word (.docx) (COM CORREÇÃO DE ERRO MULTI ERROR)
electron_1.ipcMain.handle('generate-docx', async (event, data) => {
    try {
        if (!fs_1.default.existsSync(MODELO_PATH)) {
            console.error("Modelo não encontrado em:", MODELO_PATH);
            return { success: false, error: `Modelo 'modelo_os.docx' não encontrado.` };
        }
        const content = await fs_1.default.promises.readFile(MODELO_PATH, 'binary');
        const zip = new pizzip_1.default(content);
        // Configuração para lidar melhor com loops e quebras de linha
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: true,
            linebreaks: true
        });
        // Converte dados para Maiúsculas e garante Strings para evitar erros
        const renderData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v || '')]));
        // --- BLOCO DE RENDERIZAÇÃO SEGURO ---
        try {
            doc.render(renderData);
        }
        catch (error) {
            // Captura erros específicos do Docxtemplater (Tags mal formatadas, chaves abertas, etc)
            if (error.properties && error.properties.errors) {
                const errorMessages = error.properties.errors
                    .map((e) => e.properties.explanation)
                    .join(' | ');
                console.error("Erro detalhado do Template:", errorMessages);
                throw new Error(`Erro no Modelo Word: ${errorMessages}`);
            }
            throw error;
        }
        // -------------------------------------
        const rawName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`;
        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path_1.default.join(OUTPUT_DIR, safeName);
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        await fs_1.default.promises.writeFile(filePath, buffer);
        return { success: true, path: filePath };
    }
    catch (error) {
        console.error("Erro ao gerar DOCX:", error);
        return { success: false, error: error.message || String(error) };
    }
});
// 4. Escanear Arquivos (Recuperação Inteligente)
electron_1.ipcMain.handle('scan-files', async () => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: false, count: 0 };
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        const recovered = [];
        let maxId = 3825;
        for (const file of files) {
            if (!file.endsWith('.docx'))
                continue;
            const parts = file.replace('.docx', '').split(' - ');
            if (parts.length >= 2) {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) {
                    if (id > maxId)
                        maxId = id;
                    const stats = await fs_1.default.promises.stat(path_1.default.join(OUTPUT_DIR, file));
                    let valorRecuperado = "R$ 0,00";
                    let telefoneRecuperado = "";
                    // Leitura Inteligente do Conteúdo
                    try {
                        const content = await fs_1.default.promises.readFile(path_1.default.join(OUTPUT_DIR, file), 'binary');
                        const zip = new pizzip_1.default(content);
                        if (zip.files['word/document.xml']) {
                            const xmlText = zip.files['word/document.xml'].asText();
                            const cleanText = xmlText.replace(/<[^>]+>/g, ' ');
                            const valorMatch = cleanText.match(/R\$\s?[\d.,]+/);
                            if (valorMatch)
                                valorRecuperado = valorMatch[0];
                            const telMatch = cleanText.match(/\(\d{2}\)\s?\d{4,5}-?\d{4}/);
                            if (telMatch)
                                telefoneRecuperado = telMatch[0];
                        }
                    }
                    catch (readError) {
                        console.warn(`Não foi possível ler conteúdo interno de ${file}`);
                    }
                    recovered.push({
                        os: id,
                        data: stats.birthtime.toLocaleDateString('pt-BR'),
                        cliente: parts[1] || "Desconhecido",
                        impressora: parts[2] || "Geral",
                        status: parts[3] || "Em Análise",
                        valor: valorRecuperado,
                        telefone: telefoneRecuperado,
                        orcamento: "Recuperado de Arquivo",
                        obs: "Sincronizado via Arquivo Word"
                    });
                }
            }
        }
        recovered.sort((a, b) => a.os - b.os);
        return { success: true, data: { ultimo_numero: maxId, historico: recovered } };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// --- COMANDOS DE ARQUIVO/PASTA ---
electron_1.ipcMain.handle('open-folder', async (event, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    if (!fs_1.default.existsSync(target))
        await fs_1.default.promises.mkdir(target, { recursive: true });
    await electron_1.shell.openPath(target);
});
electron_1.ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: false, error: 'Pasta vazia' };
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            await electron_1.shell.openPath(path_1.default.join(OUTPUT_DIR, file));
            return { success: true };
        }
        else {
            return { success: false, error: 'Arquivo não encontrado.' };
        }
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
// 5. Deletar Arquivo Word (NOVO)
electron_1.ipcMain.handle('delete-os-file', async (event, osId) => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: true }; // Se pasta não existe, ok
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        // Procura arquivo que comece com "ID -" (Ex: "3850 - Cliente...")
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            await fs_1.default.promises.unlink(path_1.default.join(OUTPUT_DIR, file));
            return { success: true };
        }
        // Se não achou o arquivo, retorna sucesso também (já não existe)
        return { success: true };
    }
    catch (error) {
        console.error("Erro ao apagar arquivo:", error);
        return { success: false, error: String(error) };
    }
});
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
