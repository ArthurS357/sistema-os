import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

// --- DEFINIÇÃO INTELIGENTE DE CAMINHOS ---

// 1. Onde salvar os dados (Banco, Backups, PDFs)?
// Se estiver desenvolvendo (isDev): usa a pasta do projeto.
// Se for Produção (Executável): usa a pasta onde o .exe está rodando (PORTABLE_EXECUTABLE_DIR).
const BASE_PATH = isDev
    ? path.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath));

const DB_PATH = path.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path.join(BASE_PATH, 'Backups');

// 2. Onde está o modelo do Word?
// Em Dev: na raiz do projeto (subindo um nível de dist-electron).
// Em Prod: dentro da pasta de recursos internos do Electron (resources).
const MODELO_PATH = isDev
    ? path.join(__dirname, '../modelo_os.docx')
    : path.join(process.resourcesPath, 'modelo_os.docx');

// Garante que as pastas de saída existam (Síncrono na inicialização é ok)
[OUTPUT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- FUNÇÃO DE BACKUP AUTOMÁTICO (Síncrono na inicialização) ---
function performBackup() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const now = new Date();
            // Formato: backup_YYYY-MM-DD_HH-mm.json
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupName = `backup_${timestamp}.json`;
            const backupPath = path.join(BACKUP_DIR, backupName);

            fs.copyFileSync(DB_PATH, backupPath);
            console.log(`Backup criado: ${backupName}`);

            // Limpeza: Mantém apenas os últimos 50 backups
            const files = fs.readdirSync(BACKUP_DIR);
            if (files.length > 50) {
                files.sort();
                const toDelete = files.slice(0, files.length - 50);
                toDelete.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
            }
        }
    } catch (error) {
        console.error("Erro ao criar backup:", error);
    }
}

function createWindow(): void {
    // Executa o backup assim que a janela abre
    performBackup();

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
        icon: path.join(__dirname, '../public/favicon.ico')
    });

    const startURL = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startURL);
    mainWindow.maximize();
    mainWindow.on('closed', () => { mainWindow = null; });
}

// --- COMANDOS DO SISTEMA ---

// 1. Carregar Banco de Dados
ipcMain.handle('db-load', async () => {
    try {
        // Verifica existência de forma síncrona (rápido), mas lê assíncrono
        if (fs.existsSync(DB_PATH)) {
            const data = await fs.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) { console.error(error); }
    return { ultimo_numero: 3825, historico: [] };
});

// 2. Salvar Banco de Dados (Agora ASSÍNCRONO)
ipcMain.handle('db-save', async (event, data) => {
    try {
        const jsonContent = JSON.stringify(data, null, 4);
        await fs.promises.writeFile(DB_PATH, jsonContent, 'utf-8');
        return { success: true };
    } catch (error) { return { success: false, error: String(error) }; }
});

// 3. Gerar Arquivo Word (.docx) (Agora ASSÍNCRONO)
ipcMain.handle('generate-docx', async (event, data) => {
    try {
        if (!fs.existsSync(MODELO_PATH)) {
            console.error("Modelo não encontrado em:", MODELO_PATH);
            return { success: false, error: `Modelo 'modelo_os.docx' não encontrado.` };
        }

        // Leitura assíncrona do modelo
        const content = await fs.promises.readFile(MODELO_PATH, 'binary');

        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        // Converte dados para Maiúsculas para bater com as tags do Word ({CLIENTE}, {VALOR})
        const renderData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v)]));
        doc.render(renderData);

        const rawName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`;
        // Sanitiza o nome do arquivo para evitar erro no Windows
        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path.join(OUTPUT_DIR, safeName);

        // Gera o buffer
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });

        // Escrita assíncrona do arquivo final
        await fs.promises.writeFile(filePath, buffer);

        return { success: true, path: filePath };
    } catch (error) {
        console.error("Erro ao gerar DOCX:", error);
        return { success: false, error: String(error) };
    }
});

// 4. Escanear Arquivos (Recuperação/Sincronização) (Agora ASSÍNCRONO)
ipcMain.handle('scan-files', async () => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, count: 0 };

        // Leitura assíncrona do diretório
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const recovered = [];
        let maxId = 3825;

        for (const file of files) {
            if (!file.endsWith('.docx')) continue;

            const parts = file.replace('.docx', '').split(' - ');
            if (parts.length >= 2) {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) {
                    if (id > maxId) maxId = id;

                    // Stat assíncrono para pegar a data de criação
                    const stats = await fs.promises.stat(path.join(OUTPUT_DIR, file));

                    recovered.push({
                        os: id,
                        data: stats.birthtime.toLocaleDateString('pt-BR'),
                        cliente: parts[1] || "Desconhecido",
                        impressora: parts[2] || "Geral",
                        status: parts[3] || "Em Análise",
                        valor: "R$ 0,00",
                        telefone: "",
                        orcamento: "Recuperado de Arquivo",
                        obs: "Sincronizado automaticamente"
                    });
                }
            }
        }
        recovered.sort((a, b) => a.os - b.os);
        return { success: true, data: { ultimo_numero: maxId, historico: recovered } };
    } catch (error) { return { success: false, error: String(error) }; }
});

// --- COMANDOS DE ARQUIVO/PASTA ---

// Abre pastas do sistema (Backups ou OS_Geradas)
ipcMain.handle('open-folder', async (event, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    // Garante que a pasta existe antes de abrir
    if (!fs.existsSync(target)) await fs.promises.mkdir(target, { recursive: true });
    await shell.openPath(target);
});

// Tenta encontrar e abrir o arquivo da O.S. pelo ID
ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, error: 'Pasta vazia' };

        // Leitura assíncrona do diretório
        const files = await fs.promises.readdir(OUTPUT_DIR);

        // Procura qualquer arquivo que comece com "ID - "
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));

        if (file) {
            const fullPath = path.join(OUTPUT_DIR, file);
            await shell.openPath(fullPath);
            return { success: true };
        } else {
            return { success: false, error: 'Arquivo não encontrado.' };
        }
    } catch (e) {
        return { success: false, error: String(e) };
    }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });