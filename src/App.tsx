import React, { useRef, useCallback, useMemo } from 'react';
import { Toaster } from 'sonner';
import { Search, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Command } from 'lucide-react';

import { DashboardStats } from './components/DashboardStats';
import { OSForm } from './components/OSForm';
import { OSList } from './components/OSList';

import { useOSSystem, type FilterStatus } from './hooks/useOSSystem';
import { useShortcuts } from './hooks/useShortcuts';

const FilterTab = React.memo(
  ({
    label,
    value,
    active,
    onClick,
  }: {
    label: string;
    value: FilterStatus;
    active: boolean;
    onClick: (value: FilterStatus) => void;
  }) => {
    const handleClick = useCallback(() => {
      onClick(value);
    }, [onClick, value]);

    return (
      <button
        onClick={handleClick}
        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${active
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
      >
        {label}
      </button>
    );
  }
);

FilterTab.displayName = 'FilterTab';

const LoadingScreen = () => (
  <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-400 gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    <p className="font-medium animate-pulse">Carregando Sistema...</p>
  </div>
);

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

const ErrorScreen = ({ error, onRetry }: ErrorScreenProps) => (
  <div className="flex flex-col h-screen items-center justify-center bg-rose-50 text-rose-800 p-8 text-center">
    <div className="bg-white p-8 rounded-2xl shadow-xl border border-rose-100 max-w-md w-full flex flex-col items-center">
      <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle size={32} />
      </div>
      <h1 className="text-xl font-bold mb-2">Erro de Conexão</h1>
      <p className="text-slate-600 mb-6 text-sm">
        Não foi possível carregar o Banco de Dados.<br />
        O arquivo pode estar em uso ou corrompido.
      </p>
      <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs font-mono text-rose-700 w-full mb-6 break-words">
        {error}
      </div>
      <button
        onClick={onRetry}
        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-colors"
      >
        <RefreshCw size={18} /> Tentar Novamente
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  const {
    db,
    displayItems,
    pagination,
    search,
    form,
    setForm,
    editingId,
    loading,
    error,
    retry,
    actions,
    filter,
  } = useOSSystem();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 🔹 Callbacks estáveis (dependendo apenas da função real)
  const handleSaveShortcut = useCallback(() => {
    actions.save(false);
  }, [actions.save]);

  const handlePrintShortcut = useCallback(() => {
    actions.save(true);
  }, [actions.save]);

  const handleSearchFocus = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleFilterClick = useCallback(
    (value: FilterStatus) => {
      filter.set(value);
    },
    [filter.set]
  );

  const handleOpenPending = useCallback(() => {
    filter.set('active');
  }, [filter.set]);

  const handleOpenWord = useCallback(
    (id?: number) => {
      if (id) {
        window.api.openOsFile(id);
      } else {
        actions.openWord();
      }
    },
    [actions.openWord]
  );

  const handlePreviousPage = useCallback(() => {
    pagination.setCurrentPage((p) => Math.max(1, p - 1));
  }, [pagination.setCurrentPage]);

  const handleNextPage = useCallback(() => {
    pagination.setCurrentPage((p) =>
      Math.min(pagination.totalPages, p + 1)
    );
  }, [pagination.setCurrentPage, pagination.totalPages]);

  useShortcuts({
    onSave: handleSaveShortcut,
    onPrint: handlePrintShortcut,
    onNew: actions.clear,
    onSearchFocus: handleSearchFocus,
  });

  const filterTabs = useMemo(
    () => [
      { label: 'Todas', value: 'all' as FilterStatus },
      { label: 'Na Bancada', value: 'active' as FilterStatus },
      { label: 'Finalizadas', value: 'finished' as FilterStatus },
    ],
    []
  );

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={retry} />;

  return (
    <div className="flex h-screen bg-slate-100 font-sans p-4 gap-5 overflow-hidden text-slate-700">
      <Toaster position="top-right" richColors />

      <OSForm
        form={form}
        setForm={setForm}
        editingId={editingId}
        onSave={actions.save}
        onClear={actions.clear}
        onDelete={actions.delete}
        onOpenWord={handleOpenWord}
        onSyncSingle={actions.syncSingle}
      />

      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
        <DashboardStats
          historico={db.historico}
          onOpenPending={handleOpenPending}
        />

        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex gap-2">
            {filterTabs.map((tab) => (
              <FilterTab
                key={tab.value}
                label={tab.label}
                value={tab.value}
                active={filter.value === tab.value}
                onClick={handleFilterClick}
              />
            ))}
          </div>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-shadow">
            <div className="bg-slate-100 p-2 rounded-lg text-slate-400">
              <Search size={20} />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por Cliente, Número da O.S. ou Equipamento... (Ctrl+F)"
              className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />

            <div className="hidden xl:flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
              <Command size={10} /> F
            </div>

            <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 whitespace-nowrap">
              Total: {pagination.totalItems}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <OSList
            historico={displayItems}
            editingId={editingId}
            onEdit={actions.edit}
            onSync={actions.sync}
            onOpenFolder={actions.openFolder}
            onExport={actions.exportData}
            onOpenWord={handleOpenWord}
          />
        </div>

        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center shrink-0">
          <button
            onClick={handlePreviousPage}
            disabled={pagination.currentPage === 1}
            className="px-3 py-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors"
          >
            <ChevronLeft size={18} /> Anterior
          </button>

          <span className="text-sm font-medium text-slate-500">
            Página{' '}
            <strong className="text-slate-800">
              {pagination.currentPage}
            </strong>{' '}
            de{' '}
            <strong className="text-slate-800">
              {pagination.totalPages || 1}
            </strong>
          </span>

          <button
            onClick={handleNextPage}
            disabled={
              pagination.currentPage === pagination.totalPages ||
              pagination.totalPages === 0
            }
            className="px-3 py-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors"
          >
            Próxima <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
