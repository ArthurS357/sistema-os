import React from 'react';
import {
    Save, Printer, Trash2, RefreshCw, Phone,
    FileText, Monitor, User, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import type { OSFormState } from '../types';

interface OSFormProps {
    form: OSFormState;
    setForm: React.Dispatch<React.SetStateAction<OSFormState>>;
    editingId: number | null;
    onSave: (print: boolean) => void;
    onClear: () => void;
    onDelete: () => void;
    onOpenWord: () => void;
}

export const OSForm: React.FC<OSFormProps> = ({
    form, setForm, editingId, onSave, onClear, onDelete, onOpenWord
}) => {

    // --- Máscaras Locais ---
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

    const openWhatsapp = () => {
        const num = form.telefone.replace(/\D/g, '');
        if (num.length >= 10) window.open(`https://wa.me/55${num}`, '_blank');
        else toast.warning('Número inválido.');
    };

    // Ícones para o Layout de Impressão (Checkboxes)
    const CheckBoxPrint = ({ checked, label }: { checked: boolean, label: string }) => (
        <div className="flex items-center gap-2">
            <div className={`w-4 h-4 border-2 flex items-center justify-center ${checked ? 'border-black bg-black text-white' : 'border-slate-300'}`}>
                {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
    );

    return (
        <>
            {/* --- FORMULÁRIO DE TELA (Interativo) --- */}
            <div className="w-5/12 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden print:hidden">
                {/* Header */}
                <div className="bg-slate-800 p-5 flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-2 text-white">
                        <div className="bg-blue-500 p-2 rounded-lg"><FileText size={20} className="text-white" /></div>
                        <div><h1 className="text-lg font-bold leading-none">Ficha de O.S.</h1><p className="text-xs text-slate-400">Preencha os dados</p></div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-lg font-mono text-xl font-bold border-2 ${editingId ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-white/10 text-white border-white/20'}`}>{editingId ? `#${editingId}` : 'NOVA'}</div>
                </div>

                {/* Body */}
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
                            <div className="flex-1 relative group"><input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-right" placeholder="R$ 0,00" value={form.valor} onChange={e => setForm({ ...form, valor: formatCurrency(e.target.value) })} onKeyDown={e => e.key === 'Enter' && onSave(false)} /></div>
                            <div className="flex-1"><select className="w-full h-full px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-sm font-medium" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Em Análise</option><option>Aprovado</option><option>Reprovado</option><option>Aprovado - Entregue</option><option>Reprovado - Entregue</option></select></div>
                        </div>
                        <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none text-sm h-20" placeholder="Obs extras..." value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} onKeyDown={e => e.key === 'Enter' && onSave(false)} />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
                    <button onClick={() => onSave(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2"><Save size={20} /> SALVAR</button>
                    <div className="flex gap-2">
                        <button onClick={() => onSave(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium shadow-md flex justify-center items-center gap-2"><Printer size={18} /> + Imprimir</button>
                        <button onClick={onClear} className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2.5 rounded-xl font-medium flex justify-center items-center gap-2"><RefreshCw size={18} /></button>
                        {editingId && <button onClick={onDelete} className="px-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl flex justify-center items-center"><Trash2 size={18} /></button>}
                    </div>
                    {editingId && (
                        <button onClick={onOpenWord} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-xl flex justify-center items-center gap-2 mt-1">
                            <FileText size={18} /> Abrir Arquivo Word
                        </button>
                    )}
                </div>
            </div>

            {/* --- LAYOUT DE IMPRESSÃO (Escondido na tela, Visível na Impressora) --- */}
            <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black font-sans">
                {/* Cabeçalho */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">CapCom System</h1>
                        <p className="text-sm mt-1">Assistência Técnica Especializada</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-mono font-bold">#{editingId || 'NOVA'}</p>
                        <p className="text-sm mt-1">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>

                {/* Info do Cliente */}
                <div className="mb-6 border border-black rounded-lg p-4">
                    <h2 className="font-bold uppercase text-xs mb-3 border-b border-gray-300 pb-1 w-full">Dados do Cliente</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Cliente</span>
                            <span className="block font-bold text-lg">{form.cliente}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Telefone</span>
                            <span className="block font-bold text-lg">{form.telefone}</span>
                        </div>
                    </div>
                </div>

                {/* Info do Equipamento */}
                <div className="mb-6 border border-black rounded-lg p-4">
                    <h2 className="font-bold uppercase text-xs mb-3 border-b border-gray-300 pb-1 w-full">Equipamento</h2>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Modelo / Equipamento</span>
                            <span className="block font-bold text-xl">{form.impressora}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Defeito Reclamado</span>
                            <p className="font-medium text-lg leading-snug">{form.orcamento}</p>
                        </div>
                    </div>

                    {/* Checklist de Entrada */}
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 flex gap-6 mt-2">
                        <CheckBoxPrint checked={form.cabos.forca} label="Cabo de Força" />
                        <CheckBoxPrint checked={form.cabos.usb} label="Cabo USB" />
                        <CheckBoxPrint checked={form.cabos.cartuchos} label="Cartuchos" />
                        <CheckBoxPrint checked={form.cabos.ligando} label="LIGANDO" />
                    </div>
                </div>

                {/* Obs / Laudo */}
                <div className="mb-6 border border-black rounded-lg p-4 min-h-[150px]">
                    <h2 className="font-bold uppercase text-xs mb-2 border-b border-gray-300 pb-1 w-full">Observações Técnicas</h2>
                    <p className="whitespace-pre-wrap text-base">{form.obs || 'Sem observações adicionais.'}</p>
                </div>

                {/* Rodapé e Assinatura */}
                <div className="mt-auto pt-10 grid grid-cols-2 gap-10 items-end">
                    <div className="text-center">
                        <div className="border-t border-black w-3/4 mx-auto pt-2"></div>
                        <p className="text-sm">Assinatura do Técnico</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-sm text-gray-500 uppercase">Valor Total</span>
                        <span className="block text-4xl font-bold">{form.valor || 'R$ 0,00'}</span>
                    </div>
                </div>

                {/* Status Final */}
                <div className="mt-8 text-center bg-gray-100 py-2 border border-gray-300 rounded">
                    <p className="text-sm uppercase font-bold text-gray-600">Status Atual: {form.status}</p>
                </div>
            </div>
        </>
    );
};