"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Serviços
const BackupService_1 = require("./services/BackupService");
const WordService_1 = require("./services/WordService");
const DatabaseService_1 = require("./services/DatabaseService");
const ScanService_1 = require("./services/ScanService");
// --- CONFIGURAÇÃO ---
const isDev = !electron_1.app.isPackaged;
const BASE_PATH = isDev
    ? path_1.default.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path_1.default.dirname(process.execPath));
const DB_PATH = path_1.default.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path_1.default.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path_1.default.join(BASE_PATH, 'Backups');
const MODELO_PATH = isDev
    ? path_1.default.join(__dirname, '../modelo_os.docx')
    : path_1.default.join(process.resourcesPath, 'modelo_os.docx');
// --- INSTANCIANDO SERVIÇOS ---
const backupService = new BackupService_1.BackupService(DB_PATH, BACKUP_DIR);
const wordService = new WordService_1.WordService(MODELO_PATH, OUTPUT_DIR);
const dbService = new DatabaseService_1.DatabaseService(DB_PATH);
const scanService = new ScanService_1.ScanService(OUTPUT_DIR);
let mainWindow = null;
function createWindow() {
    backupService.performBackup();
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
    const startURL = isDev
        ? 'http://localhost:5173'
        : `file://${path_1.default.join(__dirname, '../dist/index.html')}`;
    mainWindow.loadURL(startURL);
}
// --- API HANDLERS ---
// 1. Banco de Dados
electron_1.ipcMain.handle('db-load', () => dbService.load());
electron_1.ipcMain.handle('db-save', (_, data) => dbService.save(data));
// 2. Documentos
electron_1.ipcMain.handle('generate-docx', (_, data) => wordService.generate(data));
// 3. Sistema de Arquivos (Scan e Gestão)
electron_1.ipcMain.handle('scan-files', () => scanService.scanFiles());
electron_1.ipcMain.handle('delete-os-file', async (_, osId) => {
    if (typeof osId !== 'number')
        return { success: false, error: "ID inválido" };
    try {
        if (!fs_1.default.existsSync(OUTPUT_DIR))
            return { success: true };
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        // Regex para garantir que deletamos o arquivo certo (ID no início)
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));
        if (file)
            await fs_1.default.promises.unlink(path_1.default.join(OUTPUT_DIR, file));
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
electron_1.ipcMain.handle('open-folder', async (_, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    if (!fs_1.default.existsSync(target))
        await fs_1.default.promises.mkdir(target, { recursive: true });
    await electron_1.shell.openPath(target);
});
electron_1.ipcMain.handle('open-os-file', async (_, osId) => {
    if (typeof osId !== 'number')
        return { success: false, error: "ID inválido" };
    try {
        const files = await fs_1.default.promises.readdir(OUTPUT_DIR);
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));
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
