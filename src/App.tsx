import React from 'react';
import { Toaster } from 'sonner';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

// Componentes
import { DashboardStats } from './components/DashboardStats';
import { OSForm } from './components/OSForm';
import { OSList } from './components/OSList';

// Hook de Lógica
import { useOSSystem } from './hooks/useOSSystem';

const App: React.FC = () => {
  // Chamamos nosso Custom Hook que nos devolve tudo pronto, incluindo paginação e busca
  const {
    db,
    displayItems, // Itens filtrados da página atual
    pagination,
    search,
    form,
    setForm,
    editingId,
    loading,
    actions
  } = useOSSystem();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 animate-pulse">
        Carregando Sistema...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans p-4 gap-5 overflow-hidden text-slate-700">
      <Toaster position="top-right" richColors />

      {/* Formulário (Esquerda) */}
      <OSForm
        form={form}
        setForm={setForm}
        editingId={editingId}
        onSave={actions.save}
        onClear={actions.clear}
        onDelete={actions.delete}
        onOpenWord={actions.openWord}
      />

      {/* Área Direita (Dashboard + Lista) */}
      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">

        {/* 1. Stats (Usa o banco completo para totais reais) */}
        <DashboardStats historico={db.historico} />

        {/* 2. Barra de Busca */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 shrink-0">
          <div className="bg-slate-100 p-2 rounded-lg text-slate-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Buscar por Cliente, Número da O.S. ou Equipamento..."
            className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
          />
          <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 whitespace-nowrap">
            Total: {pagination.totalItems}
          </div>
        </div>

        {/* 3. Lista (Usa apenas os itens da página atual) */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <OSList
            historico={displayItems} // Passamos apenas os 50 itens aqui!
            editingId={editingId}
            onEdit={actions.edit}
            onSync={actions.sync}
            onOpenFolder={actions.openFolder}
          />
        </div>

        {/* 4. Controles de Paginação */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center shrink-0">
          <button
            onClick={() => pagination.setCurrentPage(p => Math.max(1, p - 1))}
            disabled={pagination.currentPage === 1}
            className="px-3 py-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors"
          >
            <ChevronLeft size={18} /> Anterior
          </button>

          <span className="text-sm font-medium text-slate-500">
            Página <strong className="text-slate-800">{pagination.currentPage}</strong> de <strong className="text-slate-800">{pagination.totalPages || 1}</strong>
          </span>

          <button
            onClick={() => pagination.setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.currentPage === pagination.totalPages || pagination.totalPages === 0}
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