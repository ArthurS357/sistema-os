import React, { useMemo } from 'react';
import { Calendar, TrendingUp, DollarSign } from 'lucide-react';

// --- CORREÇÃO AQUI: Adicionado 'type' ---
import type { OSHistoryItem } from '../types';

interface DashboardStatsProps {
    historico: OSHistoryItem[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ historico }) => {
    const stats = useMemo(() => {
        const hoje = new Date().toLocaleDateString('pt-BR');
        const osHoje = historico.filter(i => i.data === hoje);

        // Função auxiliar para converter string de moeda em float
        const parseVal = (v: string) => parseFloat(v.replace(/[^0-9,-]+/g, "").replace(",", ".") || '0');

        const faturamentoHoje = osHoje.reduce((acc, curr) => acc + parseVal(curr.valor), 0);

        const chartData = [];
        for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR');
            const dayTotal = historico
                .filter(item => item.data === dateStr)
                .reduce((acc, curr) => acc + parseVal(curr.valor), 0);
            chartData.push({ day: dateStr.slice(0, 5), value: dayTotal });
        }

        const maxVal = Math.max(...chartData.map(c => c.value)) || 1;

        return {
            count: osHoje.length,
            total: faturamentoHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            chart: chartData.map(c => ({ ...c, height: (c.value / maxVal) * 100 }))
        };
    }, [historico]);

    return (
        <div className="grid grid-cols-2 gap-4">
            {/* Card: Últimos 5 dias e Contagem Hoje */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden">
                <div className="flex justify-between items-start z-10">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Calendar size={12} /> Últimos 5 dias
                        </p>
                        <p className="text-2xl font-bold text-slate-700 mt-1">
                            {stats.count} <span className="text-sm text-slate-400 font-normal">O.S. Hoje</span>
                        </p>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp size={20} />
                    </div>
                </div>

                {/* Gráfico de Barras */}
                <div className="flex items-end gap-2 h-12 mt-2 z-10">
                    {stats.chart.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end group cursor-help relative">
                            <div
                                className="w-full bg-blue-200 rounded-t-sm group-hover:bg-blue-400 transition-all"
                                style={{ height: `${Math.max(day.height, 10)}%` }}
                            ></div>
                            <span className="text-[10px] text-slate-400 text-center mt-1">{day.day}</span>

                            {/* Tooltip do valor */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
                                R$ {day.value.toFixed(2)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Card: Faturamento */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Faturamento Hoje</p>
                    <p className="text-3xl font-bold text-emerald-600 tracking-tight">{stats.total}</p>
                    <p className="text-xs text-slate-400 mt-1">Calculado sobre O.S. do dia</p>
                </div>
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <DollarSign size={32} />
                </div>
            </div>
        </div>
    );
};