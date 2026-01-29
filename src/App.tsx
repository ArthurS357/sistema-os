import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Printer, Trash2, Search, RefreshCw, Phone,
  FileText, PenTool, DollarSign, CheckCircle, AlertCircle,
  Clock, Package, Monitor, User, Database as IconDatabase,
  FolderOpen, FolderArchive
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

// --- CORREÇÃO AQUI: Adicionado 'type' ---
import type { Database, OSHistoryItem } from './types';

import { DashboardStats } from './components/DashboardStats';

const INITIAL_FORM_STATE = {
  cliente: '',
  telefone: '',
  impressora: '',
  orcamento: 'Em andamento',
  valor: '',
  obs: '',
  status: 'Em Análise',
  cabos: {
    forca: false,
    usb: false,
    cartuchos: false,
    ligando: false
  }
};

const App: React.FC = () => {
  const [db, setDb] = useState<Database>({ ultimo_numero: 3825, historico: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Carregar Dados ao Iniciar ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await window.api.loadDatabase();
        if (data) setDb(data);
      } catch (err) {
        console.error("Erro ao carregar:", err);
        toast.error("Erro ao carregar banco de dados.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- AÇÕES DE ARQUIVO ---
  const handleOpenFolder = (type: 'os' | 'backup') => {
    window.api.openFolder(type);
    toast.success(`Pasta ${type === 'os' ? 'de O.S.' : 'de Backups'} aberta!`);
  };

  const handleOpenWord = async () => {
    if (!editingId) return;
    const loadToast = toast.loading("Buscando arquivo...");
    const result = await window.api.openOsFile(editingId);
    toast.dismiss(loadToast);
    if (result.success) {
      toast.success("Arquivo aberto com sucesso!");
    } else {
      toast.error("Arquivo Word não encontrado na pasta.");
    }
  };

  const handleSyncFiles = async () => {
    if (!confirm("Isso vai ler a pasta 'OS_Geradas' e recuperar O.S. perdidas.\nDeseja continuar?")) return;
    const loadToast = toast.loading("Escaneando arquivos...");
    try {
      const result = await window.api.scanFiles();
      if (result.success && result.data) {
        const currentIds = new Set(db.historico.map(i => i.os));
        const newItems = result.data.historico.filter((i: OSHistoryItem) => !currentIds.has(i.os));

        if (newItems.length === 0) {
          toast.dismiss(loadToast);
          toast.info("Nenhum arquivo novo encontrado.");
          return;
        }

        const mergedHistory = [...db.historico, ...newItems].sort((a, b) => a.os - b.os);
        const finalMaxId = Math.max(db.ultimo_numero, result.data.ultimo_numero);
        const newDb = { ultimo_numero: finalMaxId, historico: mergedHistory };
        await saveToDisk(newDb);
        toast.dismiss(loadToast);
        toast.success(`${newItems.length} O.S. recuperadas!`);
      } else {
        toast.dismiss(loadToast);
        toast.warning("Não foi possível ler a pasta.");
      }
    } catch (e) {
      toast.dismiss(loadToast);
      toast.error("Erro na sincronização.");
    }
  };

  // --- MÁSCARAS E FORMATAÇÃO ---
  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, "").substring(0, 11);
    if (v.length > 10) return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
    if (v.length > 6) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    if (v.length > 2) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    return v;
  };

  const formatCurrency = (value: string) => {
    let v = value.replace(/\D/g, "");
    v = (parseInt(v) / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return v === "NaN" ? "" : `R$ ${v}`;
  };

  // --- CRUD ---
  const saveToDisk = async (newDb: Database) => {
    setDb(newDb);
    const result = await window.api.saveDatabase(newDb);
    if (!result.success) toast.error("Falha crítica ao salvar no disco!");
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

  const handleSave = async (print: boolean) => {
    if (!form.cliente) return toast.warning('Preencha o nome do Cliente.');
    const obsFinal = buildObsString();
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let newDb = { ...db };
    let currentId = editingId;

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
    await saveToDisk(newDb);
    handleClear();
    if (print) {
      const loadToast = toast.loading("Gerando documentos...");
      try {
        const result = await window.api.generateDocx({
          os: currentId,
          data: dataHoje,
          cliente: form.cliente,
          impressora: form.impressora,
          orcamento: form.orcamento,
          valor: form.valor,
          status: form.status,
          obs: obsFinal
        });
        toast.dismiss(loadToast);
        if (result.success) {
          window.print();
          toast.success(`O.S. ${currentId} impressa!`);
        } else {
          toast.error("Erro Word: " + result.error);
        }
      } catch (e) { toast.error("Erro interno."); }
    } else {
      toast.success(editingId ? `O.S. ${currentId} salva!` : `O.S. ${currentId} gerada!`);
    }
  };

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

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm(`Apagar O.S. ${editingId}?`)) return;
    const newHistory = db.historico.filter(item => item.os !== editingId);
    const maxId = newHistory.length > 0 ? Math.max(...newHistory.map(i => i.os)) : 3825;
    await saveToDisk({ historico: newHistory, ultimo_numero: maxId });
    handleClear();
    toast.info("O.S. removida do histórico.");
  };

  const openWhatsapp = () => {
    const num = form.telefone.replace(/\D/g, '');
    if (num.length >= 10) window.open(`https://wa.me/55${num}`, '_blank');
    else toast.warning('Número inválido.');
  };

  const filteredList = useMemo(() => {
    return [...db.historico].reverse().filter(item =>
      item.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.os.toString().includes(searchTerm)
    );
  }, [db.historico, searchTerm]);

  const StatusBadge = ({ status }: { status: string }) => {
    let colors = "bg-slate-100 text-slate-600 border-slate-200";
    let Icon = Clock;
    const s = status.toLowerCase();
    if (s.includes('aprovado')) { colors = "bg-emerald-100 text-emerald-700 border-emerald-200"; Icon = CheckCircle; }
    if (s.includes('reprovado')) { colors = "bg-rose-100 text-rose-700 border-rose-200"; Icon = AlertCircle; }
    if (s.includes('entregue')) { colors = "bg-blue-100 text-blue-700 border-blue-200"; Icon = Package; }
    return <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${colors}`}><Icon size={12} /> {status}</span>;
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Carregando...</div>;

  return (
    <div className="flex h-screen bg-slate-100 font-sans p-4 gap-5 overflow-hidden text-slate-700">
      <Toaster position="top-right" richColors />

      {/* --- FORMULÁRIO (ESQUERDA) --- */}
      <div className="w-5/12 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
        <div className="bg-slate-800 p-5 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2 text-white">
            <div className="bg-blue-500 p-2 rounded-lg"><FileText size={20} className="text-white" /></div>
            <div><h1 className="text-lg font-bold leading-none">Ficha de O.S.</h1><p className="text-xs text-slate-400">Preencha os dados</p></div>
          </div>
          <div className={`px-4 py-1.5 rounded-lg font-mono text-xl font-bold border-2 ${editingId ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-white/10 text-white border-white/20'}`}>{editingId ? `#${editingId}` : 'NOVA'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><User size={14} /> Cliente</h3>
            <div className="grid gap-4">
              <div className="relative group"><User size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" /><input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Nome" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
              <div className="flex gap-2">
                <div className="relative flex-1 group"><Phone size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" /><input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm({ ...form, telefone: formatPhone(e.target.value) })} maxLength={15} /></div>
                <button onClick={openWhatsapp} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 rounded-lg font-bold">Zap</button>
              </div>
            </div>
          </div>
          <hr className="border-slate-100" />
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Monitor size={14} /> Equipamento</h3>
            <div className="grid gap-3">
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Modelo" value={form.impressora} onChange={e => setForm({ ...form, impressora: e.target.value })} />
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Defeito..." value={form.orcamento} onChange={e => setForm({ ...form, orcamento: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {[{ l: 'Cabo Força', k: 'forca' }, { l: 'Cabo USB', k: 'usb' }, { l: 'Cartuchos', k: 'cartuchos' }, { l: 'LIGANDO?', k: 'ligando', d: true }].map((i: any) => (<label key={i.k} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white select-none ${i.d ? 'text-rose-600 font-bold' : 'text-slate-600'}`}><input type="checkbox" className="w-4 h-4" checked={(form.cabos as any)[i.k]} onChange={e => setForm({ ...form, cabos: { ...form.cabos, [i.k]: e.target.checked } })} /><span className="text-sm">{i.l}</span></label>))}
            </div>
          </div>
          <hr className="border-slate-100" />
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><DollarSign size={14} /> Fechamento</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative group"><input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-right" placeholder="R$ 0,00" value={form.valor} onChange={e => setForm({ ...form, valor: formatCurrency(e.target.value) })} onKeyDown={e => e.key === 'Enter' && handleSave(false)} /></div>
              <div className="flex-1"><select className="w-full h-full px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-sm font-medium" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Em Análise</option><option>Aprovado</option><option>Reprovado</option><option>Aprovado - Entregue</option><option>Reprovado - Entregue</option></select></div>
            </div>
            <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none text-sm h-20" placeholder="Obs extras..." value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleSave(false)} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
          <button onClick={() => handleSave(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2"><Save size={20} /> SALVAR</button>
          <div className="flex gap-2">
            <button onClick={() => handleSave(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium shadow-md flex justify-center items-center gap-2"><Printer size={18} /> + Imprimir</button>
            <button onClick={handleClear} className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2.5 rounded-xl font-medium flex justify-center items-center gap-2"><RefreshCw size={18} /></button>
            {editingId && <button onClick={handleDelete} className="px-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl flex justify-center items-center"><Trash2 size={18} /></button>}
          </div>

          {/* BOTÃO ABRIR WORD */}
          {editingId && (
            <button onClick={handleOpenWord} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-xl flex justify-center items-center gap-2 mt-1">
              <FileText size={18} /> Abrir Arquivo Word
            </button>
          )}
        </div>
      </div>

      {/* --- LISTA DIREITA --- */}
      <div className="flex-1 flex flex-col gap-5 h-full">
        {/* COMPONENTE DASHBOARD IMPORTADO */}
        <DashboardStats historico={db.historico} />

        <div className="bg-white flex-1 rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50/50">
            <div className="flex-1 relative group"><Search size={20} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500" /><input className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>

            {/* BOTÕES DE PASTA E ARQUIVO */}
            <div className="flex gap-2">
              <button onClick={() => handleOpenFolder('os')} className="p-2.5 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl shadow-sm transition-all" title="Abrir Pasta de O.S.">
                <FolderOpen size={20} />
              </button>
              <button onClick={() => handleOpenFolder('backup')} className="p-2.5 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-600 text-slate-500 rounded-xl shadow-sm transition-all" title="Abrir Pasta de Backups">
                <FolderArchive size={20} />
              </button>
              <button onClick={handleSyncFiles} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl shadow-sm transition-all" title="Sincronizar Arquivos">
                <IconDatabase size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm"><tr><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-16 text-center">#</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Cliente / Equipamento</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Valor</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-40">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map(item => (
                  <tr key={item.os} onClick={() => handleEdit(item)} className={`cursor-pointer transition-colors hover:bg-blue-50/50 group ${item.os === editingId ? 'bg-blue-50 ring-l-4 ring-blue-500' : ''}`}>
                    <td className="p-4 text-center font-bold text-slate-400 group-hover:text-blue-600">{item.os}</td>
                    <td className="p-4"><div className="font-bold text-slate-700 text-sm">{item.cliente}</div><div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><PenTool size={10} /> {item.impressora}</div></td>
                    <td className="p-4 text-right font-mono font-medium text-slate-600">{item.valor}</td>
                    <td className="p-4"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredList.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-slate-400"><Search size={32} className="mb-2 opacity-20" /><p>Nenhuma O.S. encontrada</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;