import React from 'react';
import { Toaster } from 'sonner';

// Componentes
import { DashboardStats } from './components/DashboardStats';
import { OSForm } from './components/OSForm';
import { OSList } from './components/OSList';

// Hook de Lógica
import { useOSSystem } from './hooks/useOSSystem';

const App: React.FC = () => {
  // Chamamos nosso Custom Hook que nos devolve tudo pronto
  const { db, form, setForm, editingId, loading, actions } = useOSSystem();

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
      <div className="flex-1 flex flex-col gap-5 h-full">

        <DashboardStats historico={db.historico} />

        <OSList
          historico={db.historico}
          editingId={editingId}
          onEdit={actions.edit}
          onSync={actions.sync}
          onOpenFolder={actions.openFolder}
        />
      </div>
    </div>
  );
};

export default App;