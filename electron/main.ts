import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';

// Importando todos os serviços
import { BackupService } from './services/BackupService';
import { WordService } from './services/WordService';
import { DatabaseService } from './services/DatabaseService';

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

// --- INSTÂNCIA DOS SERVIÇOS ---
const backupService = new BackupService(DB_PATH, BACKUP_DIR);
const wordService = new WordService(MODELO_PATH, OUTPUT_DIR);
const dbService = new DatabaseService(DB_PATH);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    // Backup automático ao iniciar
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

// --- ROTEAMENTO (HANDLERS) ---

// 1. Banco de Dados
ipcMain.handle('db-load', async () => {
    return await dbService.load();
});

ipcMain.handle('db-save', async (event, data) => {
    return await dbService.save(data);
});

// 2. Documentos Word
ipcMain.handle('generate-docx', async (event, data) => {
    return await wordService.generate(data);
});

// 3. Sistema de Arquivos (Scan e Gerenciamento)
// Mantemos o Scan simplificado aqui, ou podemos mover para um ScanService futuro
ipcMain.handle('scan-files', async () => {
    // Lógica simplificada de scan para manter o exemplo conciso
    // (Idealmente, mover para ScanService.ts)
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, count: 0 };
        // ... Lógica de Scan existente ...
        return { success: true, data: { ultimo_numero: 0, historico: [] } };
    } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('delete-os-file', async (event, osId) => {
    // Validação extra de segurança: ID deve ser número
    if (typeof osId !== 'number') return { success: false, error: "ID inválido" };

    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: true };
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));
        if (file) await fs.promises.unlink(path.join(OUTPUT_DIR, file));
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('open-folder', async (event, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    if (!fs.existsSync(target)) await fs.promises.mkdir(target, { recursive: true });
    await shell.openPath(target);
});

ipcMain.handle('open-os-file', async (event, osId) => {
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