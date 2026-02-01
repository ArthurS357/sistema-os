import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Database, OSHistoryItem, OSFormState } from '../types';

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
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all'); // Novo estado de filtro
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // --- CARREGAMENTO INICIAL (Blindado) ---
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Tentando carregar banco de dados...");
            const data = await window.api.loadDatabase();

            // Validação de Segurança
            if (!data || !Array.isArray(data.historico)) {
                throw new Error("Formato de banco de dados inválido recebido do sistema.");
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

    // --- HELPERS INTERNOS ---
    const saveToDisk = async (newDb: Database) => {
        setDb(newDb); // Atualização Otimista (UI primeiro)
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

    // --- LÓGICA DE FILTRAGEM E PAGINAÇÃO (OTIMIZADA) ---

    // 1. Mantém lista sempre ordenada (só recria se o banco mudar)
    const sortedHistory = useMemo(() => {
        return [...db.historico].sort((a, b) => b.os - a.os);
    }, [db.historico]);

    // 2. Aplica Filtros de Status + Busca + Paginação
    const filteredAndPaginatedData = useMemo(() => {
        let data = sortedHistory;

        // Filtro por Status (Abas)
        if (filterStatus === 'active') {
            // Mostra tudo que NÃO contém "Entregue" (ou seja, pendentes)
            data = data.filter(item => !item.status.toLowerCase().includes('entregue'));
        } else if (filterStatus === 'finished') {
            // Mostra APENAS o que contém "Entregue"
            data = data.filter(item => item.status.toLowerCase().includes('entregue'));
        }

        // Filtro por Busca (Texto)
        if (searchTerm) {
            const lowerBusca = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.cliente.toLowerCase().includes(lowerBusca) ||
                item.os.toString().includes(lowerBusca) ||
                (item.impressora && item.impressora.toLowerCase().includes(lowerBusca))
            );
        }

        // Paginação
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedItems = data.slice(startIndex, startIndex + itemsPerPage);

        return { items: paginatedItems, totalPages, totalItems };
    }, [sortedHistory, searchTerm, filterStatus, currentPage]);

    // Reseta página se mudar busca ou filtro
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

    // --- AÇÕES DO SISTEMA ---
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
        // Cria cópia segura do histórico
        let newHistory = [...db.historico];
        let newUltimoNumero = db.ultimo_numero;

        // Objeto da OS
        const osDataToSave: OSHistoryItem = {
            os: 0, // Será definido abaixo
            data: dataHoje, // Default, será mantida se for edição
            cliente: form.cliente,
            telefone: form.telefone,
            impressora: form.impressora,
            orcamento: form.orcamento,
            valor: form.valor,
            obs: obsFinal,
            status: form.status
        };

        if (editingId === null) {
            // Nova OS
            currentId = db.ultimo_numero + 1;
            newUltimoNumero = currentId;
            osDataToSave.os = currentId;
            newHistory.push(osDataToSave);
        } else {
            // Edição
            currentId = editingId;
            newHistory = newHistory.map(item => {
                if (item.os === editingId) {
                    // Mantém a data original na edição
                    return { ...osDataToSave, os: editingId, data: item.data };
                }
                return item;
            });
        }

        // Salva no JSON
        await saveToDisk({ ultimo_numero: newUltimoNumero, historico: newHistory });
        handleClear();

        // Gera Word
        try {
            const docResult = await window.api.generateDocx({
                ...osDataToSave,
                os: currentId!,
                // Se for edição, precisamos garantir que enviamos a data correta para o Word também, 
                // mas para simplificar aqui usamos 'dataHoje' ou recuperamos do histórico se preferir.
                // Neste caso, para impressão, geralmente usa-se a data atual ou a de criação. 
                // Vamos manter dataHoje para garantir que o documento saia com a data do documento gerado.
            });

            if (docResult.success && !print) toast.success(`O.S. ${currentId} salva!`);
            else if (!docResult.success) toast.error(`Salvo, mas erro no Word: ${docResult.error}`);
        } catch (e) { console.error(e); }

        if (print) window.print();
    };

    const handleDelete = async () => {
        if (!editingId || !confirm(`Tem certeza que deseja apagar a O.S. ${editingId}?`)) return;

        const idToDelete = editingId;
        const newHistory = db.historico.filter(item => item.os !== idToDelete);

        await saveToDisk({ ...db, historico: newHistory });
        handleClear();

        await window.api.deleteOsFile(idToDelete);
        toast.success("Registro apagado!");
    };

    const handleSyncFiles = async () => {
        if (!confirm("Isso vai ler a pasta 'OS_Geradas' e recuperar O.S. perdidas.\nDeseja continuar?")) return;

        const toastId = toast.loading("Escaneando arquivos...");
        try {
            const result = await window.api.scanFiles();

            if (result.success && result.data) {
                const currentIds = new Set(db.historico.map(i => i.os));
                // Filtra apenas o que não temos no banco
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
                toast.warning("Erro ao ler pasta ou pasta vazia.");
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Erro na sincronização.");
        }
    };

    // Abre pastas nativas
    const handleOpenFolder = (type: 'os' | 'backup') => window.api.openFolder(type);

    // Abre arquivo Word
    const handleOpenWord = async () => {
        if (!editingId) return;
        const result = await window.api.openOsFile(editingId);
        if (!result.success) toast.error("Arquivo não encontrado.");
    };

    return {
        // Dados
        db,
        displayItems: filteredAndPaginatedData.items,

        // Controles de Visualização
        pagination: {
            currentPage,
            setCurrentPage,
            totalPages: filteredAndPaginatedData.totalPages,
            totalItems: filteredAndPaginatedData.totalItems
        },
        search: {
            value: searchTerm,
            onChange: setSearchTerm
        },
        filter: {
            value: filterStatus,
            set: setFilterStatus
        },

        // Formulário e Estado
        form,
        setForm,
        editingId,
        loading,
        error,
        retry: loadData,

        // Ações
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