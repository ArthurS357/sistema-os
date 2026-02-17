import React from 'react';
import type { OSFormState } from '../types';

interface PrintLayoutProps {
    form: OSFormState;
    editingId: number | null;
    vias?: number;
}

const CheckBoxPrint = ({ checked, label }: { checked: boolean, label: string }) => (
    <div className="flex items-center gap-2">
        <div className={`w-5 h-5 border-2 flex items-center justify-center rounded-sm ${checked ? 'border-black bg-black text-white' : 'border-slate-400'}`}>
            {checked && <div className="w-3 h-3 bg-white rounded-sm" />}
        </div>
        <span className="text-sm font-medium">{label}</span>
    </div>
);

export const PrintLayout: React.FC<PrintLayoutProps> = ({ form, editingId, vias = 1 }) => {
    // Cria um array vazio com o tamanho baseado na quantidade de vias selecionadas
    const copiasArray = Array.from({ length: vias });

    return (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] text-black font-sans overflow-visible">
            {copiasArray.map((_, index) => (
                // break-after-page força a impressora a pular de página após cada via
                // min-h-screen garante que preencha a página, mas possa crescer se o texto for gigante
                <div
                    key={index}
                    className="p-8 min-h-screen flex flex-col break-after-page relative"
                >
                    {/* Indicador visual de quem é a via */}
                    <div className="absolute top-4 right-8 text-xs text-gray-600 font-bold uppercase tracking-widest border border-gray-400 px-3 py-1.5 rounded bg-gray-50">
                        {index === 0 ? 'Via do Cliente' : `Via da Loja (${index})`}
                    </div>

                    {/* Cabeçalho */}
                    <header className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end mt-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">CapCom System</h1>
                            <p className="text-sm mt-1 text-gray-600">Assistência Técnica Especializada</p>
                            <p className="text-xs mt-1 text-gray-500">Rua Exemplo, 123 - Centro - São Paulo/SP</p>
                            <p className="text-xs text-gray-500">(11) 99999-9999 | contato@capcom.com.br</p>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-mono font-bold text-gray-900">#{editingId || 'NOVA'}</p>
                            <p className="text-sm mt-1 text-gray-600">
                                {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </header>

                    {/* Info do Cliente */}
                    <section className="mb-6 border border-gray-800 rounded-lg p-4 bg-gray-50">
                        <h2 className="font-bold uppercase text-xs mb-3 border-b border-gray-400 pb-1 w-full text-gray-700">Dados do Cliente</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs text-gray-500 uppercase">Cliente</span>
                                <span className="block font-bold text-lg text-gray-900">{form.cliente || 'Não informado'}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500 uppercase">Telefone</span>
                                <span className="block font-bold text-lg text-gray-900">{form.telefone || 'Não informado'}</span>
                            </div>
                        </div>
                    </section>

                    {/* Info do Equipamento */}
                    <section className="mb-6 border border-gray-800 rounded-lg p-4 bg-gray-50">
                        <h2 className="font-bold uppercase text-xs mb-3 border-b border-gray-400 pb-1 w-full text-gray-700">Equipamento</h2>
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <div>
                                <span className="block text-xs text-gray-500 uppercase">Modelo / Equipamento</span>
                                <span className="block font-bold text-xl text-gray-900">{form.impressora || 'Não informado'}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500 uppercase">Defeito Reclamado</span>
                                <p className="font-medium text-lg leading-snug text-gray-900">{form.orcamento || 'Não informado'}</p>
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded border border-gray-300 flex flex-wrap gap-6 mt-2">
                            <CheckBoxPrint checked={!!form.cabos?.forca} label="Cabo de Força" />
                            <CheckBoxPrint checked={!!form.cabos?.usb} label="Cabo USB" />
                            <CheckBoxPrint checked={!!form.cabos?.cartuchos} label="Cartuchos" />
                            <CheckBoxPrint checked={!!form.cabos?.ligando} label="LIGANDO" />
                        </div>
                    </section>

                    {/* Obs / Laudo */}
                    <section className="mb-6 border border-gray-800 rounded-lg p-4 min-h-[150px] bg-gray-50">
                        <h2 className="font-bold uppercase text-xs mb-2 border-b border-gray-400 pb-1 w-full text-gray-700">Observações Técnicas</h2>
                        <p className="whitespace-pre-wrap text-base text-gray-900">
                            {form.obs || 'Sem observações adicionais.'}
                        </p>
                    </section>

                    {/* Rodapé e Assinatura */}
                    <footer className="mt-auto pt-10 grid grid-cols-2 gap-10 items-end">
                        <div className="text-center">
                            <div className="border-t border-gray-800 w-3/4 mx-auto pt-2"></div>
                            <p className="text-sm text-gray-700">Assinatura do {index === 0 ? 'Cliente' : 'Técnico'}</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-sm text-gray-600 uppercase">Valor Total</span>
                            <span className="block text-4xl font-bold text-gray-900">{form.valor || 'R$ 0,00'}</span>
                        </div>
                    </footer>

                    {/* Status Final */}
                    <div className="mt-8 text-center bg-gray-100 py-3 border border-gray-400 rounded-lg">
                        <p className="text-sm uppercase font-bold text-gray-700">Status Atual: {form.status || 'Pendente'}</p>
                    </div>

                    {/* Informações adicionais */}
                    <div className="mt-4 text-xs text-gray-500 text-center">
                        <p>Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                        <p className="mt-1">CapCom System - Todos os direitos reservados</p>
                    </div>
                </div>
            ))}
        </div>
    );
};