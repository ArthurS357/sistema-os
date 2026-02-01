import React from 'react';
import {
    Save, Printer, Trash2, RefreshCw, Phone,
    FileText, Monitor, User, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import type { OSFormState } from '../types';
import { formatPhone, formatCurrencyInput, cleanPhone } from '../utils/formatters';

// Importa o componente de layout de impressão isolado
import { PrintLayout } from './PrintLayout';

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

    const openWhatsapp = () => {
        const num = cleanPhone(form.telefone);
        if (num.length >= 10) window.open(`https://wa.me/55${num}`, '_blank');
        else toast.warning('Número inválido.');
    };

    return (
        <>
            {/* --- FORMULÁRIO DE TELA (Interativo) --- */}
            <div className="w-5/12 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden print:hidden">

                {/* Header */}
                <div className="bg-slate-800 p-5 flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-2 text-white">
                        <div className="bg-blue-500 p-2 rounded-lg">
                            <FileText size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-none">Ficha de O.S.</h1>
                            <p className="text-xs text-slate-400">Preencha os dados</p>
                        </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-lg font-mono text-xl font-bold border-2 ${editingId ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-white/10 text-white border-white/20'}`}>
                        {editingId ? `#${editingId}` : 'NOVA'}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Seção Cliente */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <User size={14} /> Cliente
                        </h3>
                        <div className="grid gap-4">
                            <div className="relative group">
                                <User size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" />
                                <input
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="Nome"
                                    value={form.cliente}
                                    onChange={e => setForm({ ...form, cliente: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1 group">
                                    <Phone size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="(00) 00000-0000"
                                        value={form.telefone}
                                        onChange={e => setForm({ ...form, telefone: formatPhone(e.target.value) })}
                                        maxLength={15}
                                    />
                                </div>
                                <button onClick={openWhatsapp} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 rounded-lg font-bold">Zap</button>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Seção Equipamento */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Monitor size={14} /> Equipamento
                        </h3>
                        <div className="grid gap-3">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Modelo"
                                value={form.impressora}
                                onChange={e => setForm({ ...form, impressora: e.target.value })}
                            />
                            <input
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Defeito..."
                                value={form.orcamento}
                                onChange={e => setForm({ ...form, orcamento: e.target.value })}
                            />
                        </div>

                        {/* Checkboxes de Cabos */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {[
                                { l: 'Cabo Força', k: 'forca' },
                                { l: 'Cabo USB', k: 'usb' },
                                { l: 'Cartuchos', k: 'cartuchos' },
                                { l: 'LIGANDO?', k: 'ligando', d: true }
                            ].map((i: any) => (
                                <label key={i.k} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white select-none ${i.d ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={(form.cabos as any)[i.k]}
                                        onChange={e => setForm({ ...form, cabos: { ...form.cabos, [i.k]: e.target.checked } })}
                                    />
                                    <span className="text-sm">{i.l}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Seção Fechamento */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <DollarSign size={14} /> Fechamento
                        </h3>
                        <div className="flex gap-3">
                            <div className="flex-1 relative group">
                                <input
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-right"
                                    placeholder="R$ 0,00"
                                    value={form.valor}
                                    onChange={e => setForm({ ...form, valor: formatCurrencyInput(e.target.value) })}
                                    onKeyDown={e => e.key === 'Enter' && onSave(false)}
                                />
                            </div>
                            <div className="flex-1">
                                <select
                                    className="w-full h-full px-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-sm font-medium"
                                    value={form.status}
                                    onChange={e => setForm({ ...form, status: e.target.value })}
                                >
                                    <option>Em Análise</option>
                                    <option>Aprovado</option>
                                    <option>Reprovado</option>
                                    <option>Aprovado - Entregue</option>
                                    <option>Reprovado - Entregue</option>
                                </select>
                            </div>
                        </div>
                        <textarea
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 resize-none text-sm h-20"
                            placeholder="Obs extras..."
                            value={form.obs}
                            onChange={e => setForm({ ...form, obs: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && onSave(false)}
                        />
                    </div>
                </div>

                {/* Footer com Botões e Dicas de Atalhos */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">

                    {/* Botão Salvar Principal (Ctrl+S) */}
                    <button
                        onClick={() => onSave(false)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 group relative"
                        title="Salvar (Ctrl+S)"
                    >
                        <Save size={20} /> SALVAR
                        <span className="absolute right-4 text-[10px] bg-emerald-800/30 px-2 py-0.5 rounded text-emerald-100 opacity-70 font-mono hidden md:block">
                            Ctrl+S
                        </span>
                    </button>

                    <div className="flex gap-2">
                        {/* Botão Imprimir (Ctrl+P) */}
                        <button
                            onClick={() => onSave(true)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium shadow-md flex justify-center items-center gap-2 relative"
                            title="Imprimir (Ctrl+P)"
                        >
                            <Printer size={18} /> + Imprimir
                            <span className="absolute right-2 text-[10px] bg-blue-800/30 px-1.5 py-0.5 rounded text-blue-100 opacity-70 font-mono hidden xl:block">
                                Ctrl+P
                            </span>
                        </button>

                        {/* Botão Limpar/Nova (F2) */}
                        <button
                            onClick={onClear}
                            className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2.5 rounded-xl font-medium flex justify-center items-center gap-2 relative"
                            title="Nova OS (F2)"
                        >
                            <RefreshCw size={18} />
                            <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-mono hidden sm:block">
                                F2
                            </span>
                        </button>

                        {/* Botão Excluir (Só aparece se editando) */}
                        {editingId && (
                            <button
                                onClick={onDelete}
                                className="px-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl flex justify-center items-center"
                                title="Excluir"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {/* Botão Abrir Word */}
                    {editingId && (
                        <button
                            onClick={onOpenWord}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-xl flex justify-center items-center gap-2 mt-1"
                        >
                            <FileText size={18} /> Abrir Arquivo Word
                        </button>
                    )}
                </div>
            </div>

            {/* --- LAYOUT DE IMPRESSÃO (Importado e Invisível na Tela) --- */}
            <PrintLayout form={form} editingId={editingId} />
        </>
    );
};