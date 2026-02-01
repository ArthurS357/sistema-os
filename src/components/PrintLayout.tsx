import React from 'react';
import type { OSFormState } from '../types';

interface PrintLayoutProps {
    form: OSFormState;
    editingId: number | null;
}

// Pequeno sub-componente auxiliar apenas para o layout de impressão
const CheckBoxPrint = ({ checked, label }: { checked: boolean, label: string }) => (
    <div className="flex items-center gap-2">
        <div className={`w-4 h-4 border-2 flex items-center justify-center ${checked ? 'border-black bg-black text-white' : 'border-slate-300'}`}>
            {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
        </div>
        <span className="text-sm font-medium">{label}</span>
    </div>
);

export const PrintLayout: React.FC<PrintLayoutProps> = ({ form, editingId }) => {
    return (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black font-sans">
            {/* Cabeçalho */}
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">CapCom System</h1>
                    <p className="text-sm mt-1">Assistência Técnica Especializada</p>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-mono font-bold">#{editingId || 'NOVA'}</p>
                    <p className="text-sm mt-1">
                        {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
    );
};