import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Database, OSHistoryItem, OSFormState } from '../types';

const INITIAL_FORM_STATE: OSFormState = {
    cliente: '',
    telefone: '',
    impressora: '',
    orcamento: 'Em andamento',
    valor: '',
    obs: '',
    status: 'Em Análise',
    cabos: { forca: false, usb: false, cartuchos: false, ligando: false }
};

export const useOSSystem = () => {
    const [db, setDb] = useState<Database>({ ultimo_numero: 3825, historico: [] });
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<OSFormState>(INITIAL_FORM_STATE);
    const [editingId, setEditingId] = useState<number | null>(null);

    // --- Inicialização ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await window.api.loadDatabase();
                if (data) setDb(data);
            } catch (err) {
                toast.error("Erro ao carregar banco de dados.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // --- Helpers Internos ---
    const saveToDisk = async (newDb: Database) => {
        setDb(newDb);
        const result = await window.api.saveDatabase(newDb);
        if (!result.success) toast.error("Falha ao salvar no disco!");
    };

    const buildObsString = () => {
        const parts: string[] = [];
        const { cabos, obs } = form;
        if (cabos.ligando && !obs.toUpperCase().includes('LIGANDO')) parts.push('[LIGANDO]');

        const itensDeixados = [];
        if (cabos.forca) itensDeixados.push('Cabo Força');
        if (cabos.usb) itensDeixados.push('Cabo USB');
        if (cabos.cartuchos) itensDeixados.push('Cartuchos Ass.');

        if (itensDeixados.length > 0) parts.push(`Deixou: ${itensDeixados.join(', ')}`);
        else if (!obs && !cabos.forca && !cabos.usb) parts.push('Cliente levou os cabos');

        if (obs) parts.push(obs);
        return parts.join(' - ');
    };

    // --- Ações Públicas (Expostas para a UI) ---
    const handleClear = () => {
        setEditingId(null);
        setForm(INITIAL_FORM_STATE);
    };

    const handleEdit = (os: OSHistoryItem) => {
        setEditingId(os.os);
        setForm({
            cliente: os.cliente,
            telefone: os.telefone,
            impressora: os.impressora,
            orcamento: os.orcamento,
            valor: os.valor,
            obs: os.obs,
            status: os.status,
            cabos: { forca: false, usb: false, cartuchos: false, ligando: false }
        });
    };

    // --- SALVAMENTO COM GERAÇÃO AUTOMÁTICA ---
    const handleSave = async (print: boolean) => {
        if (!form.cliente) return toast.warning('Preencha o nome do Cliente.');

        const obsFinal = buildObsString();
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        let newDb = { ...db };
        let currentId = editingId;

        // 1. Atualiza o Estado (Memória)
        if (editingId === null) {
            currentId = db.ultimo_numero + 1;
            const novaOS: OSHistoryItem = {
                os: currentId,
                data: dataHoje,
                cliente: form.cliente,
                telefone: form.telefone,
                impressora: form.impressora,
                orcamento: form.orcamento,
                valor: form.valor,
                obs: obsFinal,
                status: form.status
            };
            newDb.historico.push(novaOS);
            newDb.ultimo_numero = currentId;
        } else {
            newDb.historico = newDb.historico.map(item =>
                item.os === editingId
                    ? { ...item, cliente: form.cliente, telefone: form.telefone, impressora: form.impressora, orcamento: form.orcamento, valor: form.valor, obs: obsFinal, status: form.status }
                    : item
            );
        }

        // 2. Salva o Banco de Dados (JSON)
        await saveToDisk(newDb);
        handleClear();

        // 3. SEMPRE Gera o Arquivo Word (Backup Físico)
        try {
            const docResult = await window.api.generateDocx({
                os: currentId!,
                data: dataHoje,
                cliente: form.cliente,
                telefone: form.telefone,
                impressora: form.impressora,
                orcamento: form.orcamento,
                valor: form.valor,
                status: form.status,
                obs: obsFinal
            });

            if (docResult.success) {
                if (!print) toast.success(`O.S. ${currentId} salva e gerada!`);
            } else {
                toast.error(`Salvo no banco, mas erro no Word: ${docResult.error}`);
            }
        } catch (e) {
            console.error(e);
        }

        // 4. Se o usuário pediu para imprimir, chama a tela de impressão
        if (print) {
            window.print();
        }
    };

    // --- DELETAR (BANCO + ARQUIVO) ---
    const handleDelete = async () => {
        if (!editingId || !confirm(`Tem certeza que deseja apagar a O.S. ${editingId}?\nIsso excluirá também o arquivo Word.`)) return;

        const toastId = toast.loading("Apagando registros...");

        // 1. Tenta apagar o arquivo físico
        try {
            await window.api.deleteOsFile(editingId);
        } catch (e) {
            console.error("Erro ao apagar arquivo físico (pode já não existir).", e);
        }

        // 2. Apaga do Banco de Dados
        const newHistory = db.historico.filter(item => item.os !== editingId);
        const maxId = newHistory.length > 0 ? Math.max(...newHistory.map(i => i.os)) : 3825;

        await saveToDisk({ historico: newHistory, ultimo_numero: maxId });

        toast.dismiss(toastId);
        handleClear();
        toast.success("O.S. e Arquivo excluídos com sucesso!");
    };

    const handleSyncFiles = async () => {
        if (!confirm("Isso vai ler a pasta 'OS_Geradas' e recuperar O.S. perdidas.\nDeseja continuar?")) return;

        const toastId = toast.loading("Escaneando arquivos...");
        try {
            const result = await window.api.scanFiles();
            if (result.success && result.data) {
                const currentIds = new Set(db.historico.map(i => i.os));
                const newItems = result.data.historico.filter((i: OSHistoryItem) => !currentIds.has(i.os));

                if (newItems.length === 0) {
                    toast.dismiss(toastId);
                    toast.info("Nenhum arquivo novo encontrado.");
                    return;
                }

                const mergedHistory = [...db.historico, ...newItems].sort((a, b) => a.os - b.os);
                const finalMaxId = Math.max(db.ultimo_numero, result.data.ultimo_numero);

                await saveToDisk({ ultimo_numero: finalMaxId, historico: mergedHistory });
                toast.dismiss(toastId);
                toast.success(`${newItems.length} O.S. recuperadas!`);
            } else {
                toast.dismiss(toastId);
                toast.warning("Não foi possível ler a pasta.");
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Erro na sincronização.");
        }
    };

    const handleOpenFolder = (type: 'os' | 'backup') => {
        window.api.openFolder(type);
        toast.success(`Pasta aberta!`);
    };

    const handleOpenWord = async () => {
        if (!editingId) return;
        const toastId = toast.loading("Buscando arquivo...");
        const result = await window.api.openOsFile(editingId);
        toast.dismiss(toastId);
        if (result.success) toast.success("Arquivo aberto!");
        else toast.error("Arquivo não encontrado.");
    };

    return {
        db,
        form,
        setForm,
        editingId,
        loading,
        actions: {
            save: handleSave,
            edit: handleEdit,
            delete: handleDelete,
            clear: handleClear,
            sync: handleSyncFiles,
            openFolder: handleOpenFolder,
            openWord: handleOpenWord
        }
    };
};