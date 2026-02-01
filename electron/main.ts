import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';

// Serviços
import { BackupService } from './services/BackupService';
import { WordService } from './services/WordService';
import { DatabaseService } from './services/DatabaseService';
import { ScanService } from './services/ScanService';

// --- CONFIGURAÇÃO ---
const isDev = !app.isPackaged;
const BASE_PATH = isDev
    ? path.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath));

const DB_PATH = path.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path.join(BASE_PATH, 'Backups');
const MODELO_PATH = isDev
    ? path.join(__dirname, '../modelo_os.docx')
    : path.join(process.resourcesPath, 'modelo_os.docx');

// --- INSTANCIANDO SERVIÇOS ---
const backupService = new BackupService(DB_PATH, BACKUP_DIR);
const wordService = new WordService(MODELO_PATH, OUTPUT_DIR);
const dbService = new DatabaseService(DB_PATH);
const scanService = new ScanService(OUTPUT_DIR);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    backupService.performBackup();

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

    const startURL = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startURL);
}

// --- API HANDLERS ---

// 1. Banco de Dados
ipcMain.handle('db-load', () => dbService.load());
ipcMain.handle('db-save', (_, data) => dbService.save(data));

// 2. Documentos
ipcMain.handle('generate-docx', (_, data) => wordService.generate(data));

// 3. Sistema de Arquivos (Scan e Gestão)
ipcMain.handle('scan-files', () => scanService.scanFiles());

ipcMain.handle('delete-os-file', async (_, osId) => {
    if (typeof osId !== 'number') return { success: false, error: "ID inválido" };
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: true };
        const files = await fs.promises.readdir(OUTPUT_DIR);
        // Regex para garantir que deletamos o arquivo certo (ID no início)
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));

        if (file) await fs.promises.unlink(path.join(OUTPUT_DIR, file));
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('open-folder', async (_, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    if (!fs.existsSync(target)) await fs.promises.mkdir(target, { recursive: true });
    await shell.openPath(target);
});

ipcMain.handle('open-os-file', async (_, osId) => {
    if (typeof osId !== 'number') return { success: false, error: "ID inválido" };
    try {
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));
        if (file) {
            await shell.openPath(path.join(OUTPUT_DIR, file));
            return { success: true };
        }
        return { success: false, error: 'Arquivo não encontrado.' };
    } catch (e) { return { success: false, error: String(e) }; }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());