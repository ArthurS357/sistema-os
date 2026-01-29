import React, { useState, useMemo } from 'react';
import {
    Search, FolderOpen, FolderArchive, Database,
    PenTool, Clock, CheckCircle, AlertCircle, Package
} from 'lucide-react';
import type { OSHistoryItem } from '../types';

interface OSListProps {
    historico: OSHistoryItem[];
    editingId: number | null;
    onEdit: (item: OSHistoryItem) => void;
    onSync: () => void;
    onOpenFolder: (type: 'os' | 'backup') => void;
}

export const OSList: React.FC<OSListProps> = ({
    historico, editingId, onEdit, onSync, onOpenFolder
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredList = useMemo(() => {
        return [...historico].reverse().filter(item =>
            item.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.os.toString().includes(searchTerm)
        );
    }, [historico, searchTerm]);

    // Badge Local
    const StatusBadge = ({ status }: { status: string }) => {
        let colors = "bg-slate-100 text-slate-600 border-slate-200";
        let Icon = Clock;
        const s = status.toLowerCase();
        if (s.includes('aprovado')) { colors = "bg-emerald-100 text-emerald-700 border-emerald-200"; Icon = CheckCircle; }
        if (s.includes('reprovado')) { colors = "bg-rose-100 text-rose-700 border-rose-200"; Icon = AlertCircle; }
        if (s.includes('entregue')) { colors = "bg-blue-100 text-blue-700 border-blue-200"; Icon = Package; }
        return <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${colors}`}><Icon size={12} /> {status}</span>;
    };

    return (
        <div className="bg-white flex-1 rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
            {/* Barra de Busca e Ações */}
            <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50/50">
                <div className="flex-1 relative group">
                    <Search size={20} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500" />
                    <input className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onOpenFolder('os')} className="p-2.5 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl shadow-sm transition-all" title="Abrir Pasta de O.S."><FolderOpen size={20} /></button>
                    <button onClick={() => onOpenFolder('backup')} className="p-2.5 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-600 text-slate-500 rounded-xl shadow-sm transition-all" title="Abrir Pasta de Backups"><FolderArchive size={20} /></button>
                    <button onClick={onSync} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl shadow-sm transition-all" title="Sincronizar Arquivos"><Database size={20} /></button>
                </div>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm"><tr><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-16 text-center">#</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Cliente / Equipamento</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Valor</th><th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-40">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.map(item => (
                            <tr key={item.os} onClick={() => onEdit(item)} className={`cursor-pointer transition-colors hover:bg-blue-50/50 group ${item.os === editingId ? 'bg-blue-50 ring-l-4 ring-blue-500' : ''}`}>
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
    );
};