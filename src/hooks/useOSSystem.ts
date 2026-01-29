import { useState, useEffect, useMemo } from 'react';
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
    // --- ESTADOS PRINCIPAIS ---
    const [db, setDb] = useState<Database>({ ultimo_numero: 3825, historico: [] });
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<OSFormState>(INITIAL_FORM_STATE);
    const [editingId, setEditingId] = useState<number | null>(null);

    // --- ESTADOS DE OTIMIZAÇÃO (Busca e Paginação) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50; // Quantidade de itens por página

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
        setDb(newDb); // Atualiza a tela imediatamente
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

    // --- LÓGICA DE FILTRO E PAGINAÇÃO (OTIMIZAÇÃO) ---
    const filteredAndPaginatedData = useMemo(() => {
        // 1. Filtragem
        let data = db.historico;
        if (searchTerm) {
            const lowerBusca = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.cliente.toLowerCase().includes(lowerBusca) ||
                item.os.toString().includes(lowerBusca) ||
                (item.impressora && item.impressora.toLowerCase().includes(lowerBusca))
            );
        }

        // 2. Ordenação (Sempre do mais novo para o mais antigo)
        // Cria uma cópia para não mutar o estado original
        const sortedData = [...data].sort((a, b) => b.os - a.os);

        // 3. Paginação
        const totalItems = sortedData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedItems = sortedData.slice(startIndex, startIndex + itemsPerPage);

        return {
            items: paginatedItems,
            totalPages,
            totalItems
        };
    }, [db.historico, searchTerm, currentPage]);

    // Reseta para página 1 se a busca mudar
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // --- Ações Públicas ---
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

    // --- SALVAMENTO (Imutabilidade + Word) ---
    const handleSave = async (print: boolean) => {
        if (!form.cliente) return toast.warning('Preencha o nome do Cliente.');

        const obsFinal = buildObsString();
        const dataHoje = new Date().toLocaleDateString('pt-BR');

        let currentId = editingId;
        // CRUCIAL: Criamos uma cópia do array para o React detectar a mudança
        let newHistory = [...db.historico];
        let newUltimoNumero = db.ultimo_numero;

        if (editingId === null) {
            // --- CRIAÇÃO ---
            currentId = db.ultimo_numero + 1;
            newUltimoNumero = currentId;

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
            newHistory.push(novaOS);
        } else {
            // --- EDIÇÃO ---
            newHistory = newHistory.map(item =>
                item.os === editingId
                    ? {
                        ...item,
                        cliente: form.cliente,
                        telefone: form.telefone,
                        impressora: form.impressora,
                        orcamento: form.orcamento,
                        valor: form.valor,
                        obs: obsFinal,
                        status: form.status
                    }
                    : item
            );
        }

        const newDb: Database = {
            ultimo_numero: newUltimoNumero,
            historico: newHistory
        };

        // 1. Atualiza Banco e Tela
        await saveToDisk(newDb);
        handleClear();

        // 2. Gera Arquivo Word
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
                toast.error(`Salvo, mas erro no Word: ${docResult.error}`);
            }
        } catch (e) {
            console.error(e);
        }

        if (print) window.print();
    };

    // --- DELETAR (Atualiza UI Primeiro) ---
    const handleDelete = async () => {
        if (!editingId || !confirm(`Tem certeza que deseja apagar a O.S. ${editingId}?`)) return;

        const idToDelete = editingId;
        const toastId = toast.loading("Excluindo...");

        const newHistory = db.historico.filter(item => item.os !== idToDelete);
        const newDb = { ...db, historico: newHistory };

        await saveToDisk(newDb);
        handleClear();

        try {
            await window.api.deleteOsFile(idToDelete);
            toast.dismiss(toastId);
            toast.success("Registro apagado!");
        } catch (e) {
            console.error(e);
            toast.dismiss(toastId);
            toast.warning("Registro apagado, arquivo físico mantido.");
        }
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
        db, // Banco original (útil para estatísticas globais)

        // Use ISTO na sua Lista para ter filtro e paginação:
        displayItems: filteredAndPaginatedData.items,

        // Controles de paginação e busca
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