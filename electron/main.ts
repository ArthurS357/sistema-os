import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

// --- DEFINIÇÃO INTELIGENTE DE CAMINHOS ---
// Se estiver desenvolvendo (isDev): usa a pasta do projeto.
// Se for Produção (Executável): usa a pasta onde o .exe está rodando.
const BASE_PATH = isDev
    ? path.join(__dirname, '..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath));

const DB_PATH = path.join(BASE_PATH, 'banco_dados.json');
const OUTPUT_DIR = path.join(BASE_PATH, 'OS_Geradas');
const BACKUP_DIR = path.join(BASE_PATH, 'Backups');

// Caminho do modelo Word
const MODELO_PATH = isDev
    ? path.join(__dirname, '../modelo_os.docx')
    : path.join(process.resourcesPath, 'modelo_os.docx');

// Garante que as pastas de saída existam
[OUTPUT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- FUNÇÃO DE BACKUP AUTOMÁTICO ---
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
    performBackup(); // Backup ao iniciar

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
        if (fs.existsSync(DB_PATH)) {
            const data = await fs.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) { console.error(error); }
    return { ultimo_numero: 3825, historico: [] };
});

// 2. Salvar Banco de Dados
ipcMain.handle('db-save', async (event, data) => {
    try {
        const jsonContent = JSON.stringify(data, null, 4);
        await fs.promises.writeFile(DB_PATH, jsonContent, 'utf-8');
        return { success: true };
    } catch (error) { return { success: false, error: String(error) }; }
});

// 3. Gerar Arquivo Word (.docx) (COM CORREÇÃO DE ERRO PARA EVITAR TRAVAMENTO)
ipcMain.handle('generate-docx', async (event, data) => {
    try {
        if (!fs.existsSync(MODELO_PATH)) {
            console.error("Modelo não encontrado em:", MODELO_PATH);
            return { success: false, error: `Modelo 'modelo_os.docx' não encontrado.` };
        }

        const content = await fs.promises.readFile(MODELO_PATH, 'binary');
        const zip = new PizZip(content);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
        });

        // Converte dados para Maiúsculas e garante Strings para evitar erros
        const renderData = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k.toUpperCase(), String(v || '')])
        );

        // --- BLOCO DE RENDERIZAÇÃO SEGURO ---
        try {
            doc.render(renderData);
        } catch (error: any) {
            // Captura erros específicos do Docxtemplater (Tags mal formatadas, chaves abertas, etc)
            if (error.properties && error.properties.errors) {
                const errorMessages = error.properties.errors
                    .map((e: any) => e.properties.explanation)
                    .join(' | ');
                console.error("Erro detalhado do Template:", errorMessages);
                throw new Error(`Erro no Modelo Word: ${errorMessages}`);
            }
            throw error;
        }
        // -------------------------------------

        const rawName = `${data.os} - ${data.cliente} - ${data.impressora} - ${data.status}`;
        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '-').trim() + ".docx";
        const filePath = path.join(OUTPUT_DIR, safeName);

        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        await fs.promises.writeFile(filePath, buffer);

        return { success: true, path: filePath };
    } catch (error: any) {
        console.error("Erro ao gerar DOCX:", error);
        return { success: false, error: error.message || String(error) };
    }
});

// 4. Escanear Arquivos (Recuperação Inteligente)
ipcMain.handle('scan-files', async () => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, count: 0 };

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

                    const stats = await fs.promises.stat(path.join(OUTPUT_DIR, file));
                    let valorRecuperado = "R$ 0,00";
                    let telefoneRecuperado = "";

                    // Leitura Inteligente do Conteúdo
                    try {
                        const content = await fs.promises.readFile(path.join(OUTPUT_DIR, file), 'binary');
                        const zip = new PizZip(content);
                        if (zip.files['word/document.xml']) {
                            const xmlText = zip.files['word/document.xml'].asText();
                            const cleanText = xmlText.replace(/<[^>]+>/g, ' ');

                            const valorMatch = cleanText.match(/R\$\s?[\d.,]+/);
                            if (valorMatch) valorRecuperado = valorMatch[0];

                            const telMatch = cleanText.match(/\(\d{2}\)\s?\d{4,5}-?\d{4}/);
                            if (telMatch) telefoneRecuperado = telMatch[0];
                        }
                    } catch (readError) {
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
    } catch (error) { return { success: false, error: String(error) }; }
});

// 5. Deletar Arquivo Word
ipcMain.handle('delete-os-file', async (event, osId) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: true };

        const files = await fs.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));

        if (file) {
            await fs.promises.unlink(path.join(OUTPUT_DIR, file));
        }
        return { success: true };
    } catch (error) {
        console.error("Erro ao apagar arquivo:", error);
        return { success: false, error: String(error) };
    }
});

// --- COMANDOS DE ARQUIVO/PASTA ---
ipcMain.handle('open-folder', async (event, type) => {
    const target = type === 'backup' ? BACKUP_DIR : OUTPUT_DIR;
    if (!fs.existsSync(target)) await fs.promises.mkdir(target, { recursive: true });
    await shell.openPath(target);
});

ipcMain.handle('open-os-file', async (event, osId) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, error: 'Pasta vazia' };
        const files = await fs.promises.readdir(OUTPUT_DIR);
        const file = files.find(f => f.startsWith(`${osId} - `) && f.endsWith('.docx'));
        if (file) {
            await shell.openPath(path.join(OUTPUT_DIR, file));
            return { success: true };
        } else {
            return { success: false, error: 'Arquivo não encontrado.' };
        }
    } catch (e) { return { success: false, error: String(e) }; }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });