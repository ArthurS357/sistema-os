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
// 1. Onde salvar os dados (Banco, Backups, PDFs)?
// Se estiver desenvolvendo (isDev): usa a pasta do projeto.
// Se for Produção (Executável): usa a pasta onde o .exe está rodando (PORTABLE_EXECUTABLE_DIR).
const BASE_PATH = electron_is_dev_1.default
    ? path_1.default.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path_1.default.dirname(process.execPath));
const DB_PATH = path_1.default.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path_1.default.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path_1.default.join(BASE_PATH, 'Backups');
// 2. Onde está o modelo do Word?
// Em Dev: na raiz do projeto.
// Em Prod: dentro da pasta de recursos internos do Electron (process.resourcesPath).
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
            // Formato: backup_YYYY-MM-DD_HH-mm.json
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
    // Executa o backup assim que a janela abre
    performBackup();
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
        if (fs_1.default.existsSync(DB_PATH))
            return JSON.parse(fs_1.default.readFileSync(DB_PATH, 'utf-8'));
    }
    catch (error) {
        console.error(error);
    }
    return { ultimo_numero: 3825, historico: [] };
});
// 2. Salvar Banco de Dados
electron_1.ipcMain.handle('db-save', async (event, data) => {
    try {
        fs_1.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), 'utf-8');
        return { success: true };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
});
// 3. Gerar Arquivo Word (.docx)
electron_1.ipcMain.handle('generate-docx', async (event, data) => {
    try {
        // Verifica se o modelo existe (agora usando o caminho correto para Prod)
        if (!fs_1.default.existsSync(MODELO_PATH)) {
            console.error("Modelo não encontrado em:", MODELO_PATH);
            return { success: false, error: `Modelo 'modelo_os.docx' não encontrado.` };
        }
        const content = fs_1.default.readFileSync(MODELO_PATH, 'binary');
        const doc = new docxtemplater_1.default(new pizzip_1.default(content), { paragraphLoop: true, linebreaks: true });
        // Converte dados para Maiúsculas para bater com as tags do Word ({CLIENTE}, {VALOR})
        const renderData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v)]));
        doc.render(renderData);
        const rawName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`;
        // Sanitiza o nome do arquivo para evitar erro no Windows
        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path_1.default.join(OUTPUT_DIR, safeName);
        fs_1.default.writeFileSync(filePath, doc.getZip().generate({ type: 'nodebuffer' }));
        return { success: true, path: filePath };
    }
    catch (error) {
        console.error("Erro ao gerar DOCX:", error);
        return { success: false, error: String(error) };
    }
});
// 4. Escanear Arquivos (Recuperação/Sincronização)
electron_1.ipcMain.handle('scan-files', async () => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: false, count: 0 };
        const files = fs_1.default.readdirSync(OUTPUT_DIR);
        const recovered = [];
        let maxId = 3825;
        for (const file of files) {
            if (!file.endsWith('.docx'))
                continue;
            // Espera formato: "3850 - Nome - Impressora - Status.docx"
            const parts = file.replace('.docx', '').split(' - ');
            if (parts.length >= 2) {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) {
                    if (id > maxId)
                        maxId = id;
                    const stats = fs_1.default.statSync(path_1.default.join(OUTPUT_DIR, file));
                    recovered.push({
                        os: id,
                        data: stats.birthtime.toLocaleDateString('pt-BR'),
                        cliente: parts[1] || "Desconhecido",
                        impressora: parts[2] || "Geral",
                        status: parts[3] || "Em Análise",
                        valor: "R$ 0,00", // Valor infelizmente não fica no nome do arquivo
                        telefone: "",
                        orcamento: "Recuperado de Arquivo",
                        obs: "Sincronizado automaticamente"
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
// Abre pastas do sistema (Backups ou OS_Geradas)
electron_1.ipcMain.handle('open-folder', async (event, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    // Garante que a pasta existe antes de abrir
    if (!fs_1.default.existsSync(target))
        fs_1.default.mkdirSync(target, { recursive: true });
    await electron_1.shell.openPath(target);
});
// Tenta encontrar e abrir o arquivo da O.S. pelo ID
electron_1.ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: false, error: 'Pasta vazia' };
        const files = fs_1.default.readdirSync(OUTPUT_DIR);
        // Procura qualquer arquivo que comece com "ID - "
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            const fullPath = path_1.default.join(OUTPUT_DIR, file);
            await electron_1.shell.openPath(fullPath);
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
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
