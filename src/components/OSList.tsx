import React from 'react';
import { Edit, FolderOpen, RefreshCw, Download, FileText } from 'lucide-react'; // Adicionado FileText
import type { OSHistoryItem } from '../types';

interface OSListProps {
    historico: OSHistoryItem[];
    editingId: number | null;
    onEdit: (os: OSHistoryItem) => void;
    onSync: () => void;
    onOpenFolder: (type: 'os' | 'backup') => void;
    onExport: () => void;
    onOpenWord: (id?: number) => void; // <--- Atualizado para aceitar ID opcional
}

export const OSList: React.FC<OSListProps> = ({
    historico, editingId, onEdit, onSync, onOpenFolder, onExport, onOpenWord
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
            {/* Header da Lista */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    Histórico Recente
                    <span className="text-xs font-normal text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        {historico.length} exibidos
                    </span>
                </h3>
                <div className="flex gap-2">
                    {/* Botão Exportar */}
                    <button
                        onClick={onExport}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold border border-transparent hover:border-emerald-100"
                        title="Exportar para Excel (CSV)"
                    >
                        <Download size={16} /> <span className="hidden sm:inline">Excel</span>
                    </button>

                    <div className="h-4 w-px bg-slate-300 mx-1 self-center"></div>

                    <button onClick={onSync} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sincronizar Arquivos">
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={() => onOpenFolder('os')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Abrir Pasta OS">
                        <FolderOpen size={18} />
                    </button>
                </div>
            </div>

            {/* Tabela (Conteúdo) */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="p-4 border-b border-slate-100">OS</th>
                            <th className="p-4 border-b border-slate-100">Data</th>
                            <th className="p-4 border-b border-slate-100">Cliente</th>
                            <th className="p-4 border-b border-slate-100">Equipamento</th>
                            <th className="p-4 border-b border-slate-100">Valor</th>
                            <th className="p-4 border-b border-slate-100">Status</th>
                            <th className="p-4 border-b border-slate-100 w-24"></th> {/* Largura ajustada */}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                        {historico.map((item) => (
                            <tr
                                key={item.os}
                                className={`hover:bg-slate-50 transition-colors group ${editingId === item.os ? 'bg-blue-50/60 hover:bg-blue-50' : ''}`}
                            >
                                <td className="p-4 font-mono font-bold text-slate-600">#{item.os}</td>
                                <td className="p-4 text-slate-500">{item.data}</td>
                                <td className="p-4 font-medium text-slate-800">{item.cliente}</td>
                                <td className="p-4 text-slate-600 max-w-[150px] truncate" title={item.impressora}>{item.impressora}</td>
                                <td className="p-4 font-bold text-emerald-600">{item.valor}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${item.status.includes('Aprovado')
                                            ? item.status.includes('Entregue') ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            : item.status.includes('Reprovado') ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-1">
                                    {/* Botão Abrir Word Rápido */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Evita ativar a linha (edição)
                                            onOpenWord(item.os);
                                        }}
                                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Abrir Arquivo Word"
                                    >
                                        <FileText size={16} />
                                    </button>

                                    <button
                                        onClick={() => onEdit(item)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Editar Registro"
                                    >
                                        <Edit size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {historico.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                        <FolderOpen size={32} className="opacity-20" />
                        <p>Nenhum registro encontrado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};