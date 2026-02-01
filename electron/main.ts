import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// --- CORREÇÃO DO ERRO ESM ---
// Substituímos a biblioteca 'electron-is-dev' pela checagem nativa do Electron.
// Se o app NÃO estiver empacotado (!app.isPackaged), estamos em DEV.
const isDev = !app.isPackaged;

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

// --- BACKUP AUTOMÁTICO ---
function performBackup() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

            fs.copyFileSync(DB_PATH, backupPath);

            // Limpeza: Mantém apenas os últimos 50 backups
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

    // Configuração da URL de início baseada no ambiente
    const startURL = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

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

// 2. Salvar Banco (COM ESCRITA ATÔMICA - Mais Seguro)
ipcMain.handle('db-save', async (event, data) => {
    try {
        const jsonContent = JSON.stringify(data, null, 4);
        const tempPath = `${DB_PATH}.tmp`;

        // 1. Salva em um arquivo temporário primeiro
        await fs.promises.writeFile(tempPath, jsonContent, 'utf-8');

        // 2. Substitui o original instantaneamente (Atomic Rename)
        await fs.promises.rename(tempPath, DB_PATH);

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
});

// 3. Gerar DOCX (ANTI-TRAVAMENTO)
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

        // paragraphLoop: false é essencial para evitar loops infinitos
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

// 4. Scan Inteligente (COM REGEX AVANÇADO)
ipcMain.handle('scan-files', async () => {
    console.log("[SCAN] Iniciando varredura inteligente...");
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: false, count: 0 };

        const files = await fs.promises.readdir(OUTPUT_DIR);
        const recovered = [];
        let maxId = 3825;

        // Regex poderosa para achar IDs no início do arquivo
        // Aceita: "3500...", "OS 3500...", "O.S. 3500...", "Pedido 3500..."
        const idRegex = /^(?:O\.?S\.?|Nº?|PEDIDO)?\s*[.\-_]?\s*(\d{3,6})/i;

        const docxFiles = files.filter(f => f.endsWith('.docx'));

        // Limita a leitura profunda aos últimos 100 arquivos para não travar
        const recentFilesLimit = 100;
        const startIndex = Math.max(0, docxFiles.length - recentFilesLimit);

        for (let i = 0; i < docxFiles.length; i++) {
            const file = docxFiles[i];

            // Tenta extrair o ID com a Regex
            const match = file.match(idRegex);

            if (match && match[1]) {
                const id = parseInt(match[1]);

                if (!isNaN(id) && id > 0) {
                    if (id > maxId) maxId = id;

                    const stats = await fs.promises.stat(path.join(OUTPUT_DIR, file));

                    // --- Tenta adivinhar Cliente e Máquina pelo nome do arquivo ---
                    // Remove o ID encontrado e a extensão
                    let cleanName = file.replace('.docx', '').replace(match[0], '').trim();
                    // Remove sujeira do início (- ou /)
                    cleanName = cleanName.replace(/^[\s\-_/]+/, '');

                    // Divide por traço ou barra
                    const parts = cleanName.split(/[\-/]/).map(s => s.trim()).filter(s => s.length > 0);

                    let cliente = parts[0] || "Desconhecido";
                    let impressora = parts[1] || "Geral";
                    // -------------------------------------------------------------

                    let valor = "R$ 0,00";
                    let telefone = "";
                    let obs = "Recuperado pelo nome";

                    // Se for arquivo recente, lê o conteúdo interno
                    if (i >= startIndex) {
                        try {
                            const content = await fs.promises.readFile(path.join(OUTPUT_DIR, file), 'binary');
                            const zip = new PizZip(content);
                            if (zip.files['word/document.xml']) {
                                const txt = zip.files['word/document.xml'].asText().replace(/<[^>]+>/g, ' ');

                                // Busca valores monetários
                                const vMatch = txt.match(/R\$\s?[\d.,]+/);
                                // Busca telefones
                                const tMatch = txt.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);

                                if (vMatch) valor = vMatch[0];
                                if (tMatch) telefone = tMatch[0];
                                obs = "Sincronizado Completo";
                            }
                        } catch (e) { /* Ignora erro de leitura */ }
                    }

                    recovered.push({
                        os: id,
                        data: stats.birthtime.toLocaleDateString('pt-BR'),
                        cliente: cliente,
                        impressora: impressora,
                        status: file.toLowerCase().includes('entregue') ? 'Entregue' : 'Em Análise',
                        valor, telefone,
                        orcamento: "Recuperado",
                        obs
                    });
                }
            }
        }

        // Remove duplicados mantendo o mais recente e ordena
        const uniqueMap = new Map();
        recovered.forEach(item => uniqueMap.set(item.os, item));
        const uniqueRecovered = Array.from(uniqueMap.values()).sort((a: any, b: any) => a.os - b.os);

        console.log(`[SCAN] Concluído. ${uniqueRecovered.length} arquivos.`);
        return { success: true, data: { ultimo_numero: maxId, historico: uniqueRecovered } };
    } catch (e) { return { success: false, error: String(e) }; }
});

// 5. Deletar Arquivo
ipcMain.handle('delete-os-file', async (event, osId) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return { success: true };
        const files = await fs.promises.readdir(OUTPUT_DIR);
        // Procura qualquer arquivo que comece com o ID seguido de delimitadores comuns
        const idRegex = new RegExp(`^(?:O\\.?S\\.?)?\\s*${osId}[\\s.\\-_]`, 'i');
        const file = files.find(f => f.endsWith('.docx') && idRegex.test(f));

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
        // Busca inteligente também na hora de abrir
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