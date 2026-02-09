import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Serviços
import { BackupService } from './services/BackupService';
import { WordService } from './services/WordService';
import { DatabaseService } from './services/DatabaseService';
import { ScanService } from './services/ScanService';

// --- CONFIGURAÇÃO DE CAMINHOS (CORREÇÃO DE PERMISSÃO) ---
const isDev = !app.isPackaged;

// Lógica Inteligente de Caminho:
// 1. DEV: Pasta do projeto
// 2. PORTABLE (USB): Pasta onde o .exe está
// 3. INSTALADO: Pasta de Dados do Usuário (%APPDATA%) -> Corrige erro de permissão no Windows
const BASE_PATH = isDev
    ? path.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData'));

const DB_PATH = path.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path.join(BASE_PATH, 'Backups');

// O modelo continua fixo nos recursos do app (somente leitura)
const MODELO_PATH = isDev
    ? path.join(__dirname, '../modelo_os.docx')
    : path.join(process.resourcesPath, 'modelo_os.docx');

// Log para debug em produção (se necessário abrir console)
console.log('Base Path configurado:', BASE_PATH);

// --- INSTANCIANDO SERVIÇOS ---
const backupService = new BackupService(DB_PATH, BACKUP_DIR);
const wordService = new WordService(MODELO_PATH, OUTPUT_DIR);
const dbService = new DatabaseService(DB_PATH);
const scanService = new ScanService(OUTPUT_DIR);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    // Tenta fazer backup ao iniciar, mas protegido contra erros para não travar o boot
    try {
        backupService.performBackup();
    } catch (e) {
        console.error("Falha no backup inicial (ignorado):", e);
    }

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Cap.Com System",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        // Garante que o ícone exista ou usa padrão do sistema
        icon: fs.existsSync(path.join(__dirname, '../public/favicon.ico'))
            ? path.join(__dirname, '../public/favicon.ico')
            : undefined
    });

    const startURL = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startURL);

    // Tratamento de erro de carregamento (Tela Branca)
    mainWindow.webContents.on('did-fail-load', () => {
        dialog.showErrorBox(
            'Erro de Carregamento',
            'A interface não pôde ser carregada. Se estiver em produção, verifique se a pasta "dist" foi gerada corretamente.'
        );
        if (!isDev) mainWindow?.webContents.openDevTools();
    });
}

// --- API HANDLERS (COMUNICAÇÃO FRONTEND <-> BACKEND) ---

// 1. Banco de Dados
ipcMain.handle('db-load', () => dbService.load());
ipcMain.handle('db-save', (_, data) => dbService.save(data));

// 2. Documentos
ipcMain.handle('generate-docx', (_, data) => wordService.generate(data));

// 3. Sistema de Arquivos (Scan Geral)
ipcMain.handle('scan-files', () => scanService.scanFiles());

// 4. Scan Manual de Arquivo Único (Botão Refresh)
ipcMain.handle('scan-single', async (_, osId) => {
    if (typeof osId !== 'number') return { success: false, error: "ID inválido" };
    return await scanService.syncSingleFile(osId);
});

// 5. Deletar Arquivo
ipcMain.handle('delete-os-file', async (_, osId) => {
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

// 6. Abrir Pasta
ipcMain.handle('open-folder', async (_, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    // Garante que a pasta existe antes de abrir, criando se necessário
    if (!fs.existsSync(target)) {
        try {
            await fs.promises.mkdir(target, { recursive: true });
        } catch (err) {
            return { success: false, error: "Erro ao criar diretório." };
        }
    }
    await shell.openPath(target);
});

// 7. Abrir Arquivo Word Específico
ipcMain.handle('open-os-file', async (_, osId) => {
    if (typeof osId !== 'number') return { success: false, error: "ID inválido" };
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, error: "Pasta de OS ainda não existe." };

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