import fs from 'fs';
import path from 'path';

export class BackupService {
    private dbPath: string;
    private backupDir: string;

    constructor(dbPath: string, backupDir: string) {
        this.dbPath = dbPath;
        this.backupDir = backupDir;
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    public performBackup(): void {
        try {
            if (!fs.existsSync(this.dbPath)) return;

            const now = new Date();
            // Formato de data seguro para nome de arquivo
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
            const backupPath = path.join(this.backupDir, `backup_${timestamp}.json`);

            fs.copyFileSync(this.dbPath, backupPath);
            this.cleanOldBackups();
        } catch (error) {
            console.error("[Backup] Erro ao realizar backup:", error);
        }
    }

    private cleanOldBackups(): void {
        try {
            if (!fs.existsSync(this.backupDir)) return;

            const files = fs.readdirSync(this.backupDir);
            // Filtra apenas arquivos que parecem backups nossos
            const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.json'));

            if (backupFiles.length > 50) {
                backupFiles.sort(); // Ordena por data (o nome ajuda nisso)
                // Remove os mais antigos (do início da lista até sobrar 50)
                const toDelete = backupFiles.slice(0, backupFiles.length - 50);

                toDelete.forEach(f => {
                    const fullPath = path.join(this.backupDir, f);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                });
                console.log(`[Backup] Limpeza: ${toDelete.length} arquivos antigos removidos.`);
            }
        } catch (error) {
            console.error("[Backup] Erro na limpeza:", error);
        }
    }
}