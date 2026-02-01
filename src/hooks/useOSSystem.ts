import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Database, OSHistoryItem, OSFormState } from '../types';
import { exportToCSV } from '../utils/exporter';

// Definindo o tipo para os filtros de status
export type FilterStatus = 'all' | 'active' | 'finished';

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
    // --- ESTADOS PRINCIPAIS ---
    const [db, setDb] = useState<Database>({ ultimo_numero: 3825, historico: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<OSFormState>(INITIAL_FORM_STATE);
    const [editingId, setEditingId] = useState<number | null>(null);

    // --- ESTADOS DE NAVEGAÇÃO E FILTROS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // --- CARREGAMENTO INICIAL ---
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Tentando carregar banco de dados...");
            const data = await window.api.loadDatabase();

            if (!data || !Array.isArray(data.historico)) {
                throw new Error("Formato de banco de dados inválido.");
            }

            setDb(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Falha desconhecida ao ler banco de dados.");
            toast.error("Erro crítico ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- HELPERS ---
    const saveToDisk = async (newDb: Database) => {
        setDb(newDb);
        const result = await window.api.saveDatabase(newDb);
        if (!result.success) {
            toast.error(`Falha ao salvar no disco: ${result.error}`);
        }
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

    // --- FILTRAGEM E PAGINAÇÃO ---
    const sortedHistory = useMemo(() => {
        return [...db.historico].sort((a, b) => b.os - a.os);
    }, [db.historico]);

    const filteredAndPaginatedData = useMemo(() => {
        let data = sortedHistory;

        if (filterStatus === 'active') {
            data = data.filter(item => !item.status.toLowerCase().includes('entregue'));
        } else if (filterStatus === 'finished') {
            data = data.filter(item => item.status.toLowerCase().includes('entregue'));
        }

        if (searchTerm) {
            const lowerBusca = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.cliente.toLowerCase().includes(lowerBusca) ||
                item.os.toString().includes(lowerBusca) ||
                (item.impressora && item.impressora.toLowerCase().includes(lowerBusca))
            );
        }

        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedItems = data.slice(startIndex, startIndex + itemsPerPage);

        return { items: paginatedItems, totalPages, totalItems };
    }, [sortedHistory, searchTerm, filterStatus, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

    // --- AÇÕES ---
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

    const handleSave = async (print: boolean) => {
        if (!form.cliente) return toast.warning('Preencha o nome do Cliente.');

        const obsFinal = buildObsString();
        const dataHoje = new Date().toLocaleDateString('pt-BR');

        let currentId = editingId;
        let newHistory = [...db.historico];
        let newUltimoNumero = db.ultimo_numero;

        const osDataToSave: OSHistoryItem = {
            os: 0,
            data: dataHoje,
            cliente: form.cliente,
            telefone: form.telefone,
            impressora: form.impressora,
            orcamento: form.orcamento,
            valor: form.valor,
            obs: obsFinal,
            status: form.status
        };

        if (editingId === null) {
            currentId = db.ultimo_numero + 1;
            newUltimoNumero = currentId;
            osDataToSave.os = currentId;
            newHistory.push(osDataToSave);
        } else {
            currentId = editingId;
            newHistory = newHistory.map(item =>
                item.os === editingId ? { ...osDataToSave, os: editingId, data: item.data } : item
            );
        }

        await saveToDisk({ ultimo_numero: newUltimoNumero, historico: newHistory });
        handleClear();

        try {
            const docResult = await window.api.generateDocx({
                ...osDataToSave,
                os: currentId!,
            });
            if (docResult.success && !print) toast.success(`O.S. ${currentId} salva!`);
            else if (!docResult.success) toast.error(`Erro Word: ${docResult.error}`);
        } catch (e) { console.error(e); }

        if (print) window.print();
    };

    const handleDelete = async () => {
        if (!editingId || !confirm(`Apagar O.S. ${editingId}?`)) return;
        const idToDelete = editingId;
        const newHistory = db.historico.filter(item => item.os !== idToDelete);
        await saveToDisk({ ...db, historico: newHistory });
        handleClear();
        await window.api.deleteOsFile(idToDelete);
        toast.success("Apagado!");
    };

    const handleSyncFiles = async () => {
        if (!confirm("Isso vai ler a pasta 'OS_Geradas'. Continuar?")) return;
        const toastId = toast.loading("Escaneando arquivos...");
        try {
            const result = await window.api.scanFiles();
            if (result.success && result.data) {
                const currentIds = new Set(db.historico.map(i => i.os));
                const newItems = result.data.historico.filter((i: OSHistoryItem) => !currentIds.has(i.os));

                if (newItems.length === 0) {
                    toast.dismiss(toastId);
                    toast.info("Nada novo encontrado.");
                    return;
                }

                const mergedHistory = [...db.historico, ...newItems].sort((a, b) => a.os - b.os);
                const finalMaxId = Math.max(db.ultimo_numero, result.data.ultimo_numero);

                await saveToDisk({ ultimo_numero: finalMaxId, historico: mergedHistory });
                toast.dismiss(toastId);
                toast.success(`${newItems.length} recuperados!`);
            } else {
                toast.dismiss(toastId);
                toast.warning("Erro ao ler pasta.");
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Erro no sync.");
        }
    };

    // --- CORREÇÃO AQUI: Usando o método nomeado ---
    const handleSyncSingle = async (osId: number) => {
        const toastId = toast.loading("Lendo arquivo...");
        try {
            // Agora chamamos window.api.scanSingle em vez de invoke direto
            const result = await window.api.scanSingle(osId);

            if (result.success && result.data) {
                const newHistory = db.historico.map(item =>
                    item.os === osId ? { ...item, ...result.data } : item
                );

                await saveToDisk({ ...db, historico: newHistory });

                if (editingId === osId) {
                    setForm(prev => ({
                        ...prev,
                        cliente: result.data.cliente,
                        valor: result.data.valor,
                        impressora: result.data.impressora,
                        obs: result.data.obs,
                        status: result.data.status,
                        telefone: result.data.telefone,
                        orcamento: result.data.orcamento
                    }));
                }
                toast.dismiss(toastId);
                toast.success("Atualizado do arquivo!");
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || "Arquivo não encontrado.");
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Erro ao sincronizar.");
        }
    };

    const handleOpenFolder = (type: 'os' | 'backup') => window.api.openFolder(type);

    const handleOpenWord = async () => {
        if (!editingId) return;
        const result = await window.api.openOsFile(editingId);
        if (!result.success) toast.error("Arquivo não encontrado.");
    };

    const handleExport = () => {
        let dataToExport = [...db.historico].sort((a, b) => b.os - a.os);
        if (filterStatus === 'active') dataToExport = dataToExport.filter(item => !item.status.toLowerCase().includes('entregue'));
        else if (filterStatus === 'finished') dataToExport = dataToExport.filter(item => item.status.toLowerCase().includes('entregue'));

        if (searchTerm) {
            const lowerBusca = searchTerm.toLowerCase();
            dataToExport = dataToExport.filter(item =>
                item.cliente.toLowerCase().includes(lowerBusca) ||
                item.os.toString().includes(lowerBusca) ||
                (item.impressora && item.impressora.toLowerCase().includes(lowerBusca))
            );
        }

        const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nomeArquivo = `Relatorio_${filterStatus}_${timestamp}.csv`;
        exportToCSV(dataToExport, nomeArquivo);
        toast.success(`Exportado: ${dataToExport.length} itens.`);
    };

    return {
        db, displayItems: filteredAndPaginatedData.items,
        pagination: {
            currentPage, setCurrentPage,
            totalPages: filteredAndPaginatedData.totalPages,
            totalItems: filteredAndPaginatedData.totalItems
        },
        search: { value: searchTerm, onChange: setSearchTerm },
        filter: { value: filterStatus, set: setFilterStatus },
        form, setForm, editingId,
        loading, error, retry: loadData,
        actions: {
            save: handleSave, edit: handleEdit, delete: handleDelete, clear: handleClear,
            sync: handleSyncFiles, syncSingle: handleSyncSingle,
            openFolder: handleOpenFolder, openWord: handleOpenWord, exportData: handleExport
        }
    };
};