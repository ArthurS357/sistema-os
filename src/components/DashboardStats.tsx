import React, { useMemo } from 'react';
import {
    Calendar, TrendingUp, DollarSign,
    CreditCard, Hourglass, BarChart3
} from 'lucide-react';
import type { OSHistoryItem } from '../types';
import { parseCurrency, formatCurrencyDisplay } from '../utils/formatters';

interface DashboardStatsProps {
    historico: OSHistoryItem[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ historico }) => {

    const stats = useMemo(() => {
        const hojeDate = new Date();
        const hojeStr = hojeDate.toLocaleDateString('pt-BR');
        const mesAtualStr = hojeStr.substring(3); // Pega 'MM/AAAA' (ex: '02/2026')

        // Filtros Básicos
        const osHoje = historico.filter(i => i.data === hojeStr);
        const osMes = historico.filter(i => i.data.includes(mesAtualStr));

        // Status que consideramos "Dinheiro Pendente" (Trabalho na mesa)
        const osPendentes = historico.filter(i =>
            ['Em Análise', 'Aprovado'].includes(i.status)
        );

        // --- CÁLCULOS FINANCEIROS ---

        // 1. Faturamento Hoje (O que entrou/saiu hoje)
        const faturamentoHoje = osHoje.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

        // 2. Faturamento Mês (Acumulado)
        const faturamentoMes = osMes.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

        // 3. Pendente (Potencial de ganho parado na loja)
        const valorPendente = osPendentes.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

        // --- DADOS DO GRÁFICO (Últimos 7 dias) ---
        const chartData = [];
        const daysToShow = 7;

        for (let i = daysToShow - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR');
            const dayShort = dateStr.slice(0, 5); // 'DD/MM'

            const dayTotal = historico
                .filter(item => item.data === dateStr)
                .reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

            chartData.push({ day: dayShort, value: dayTotal });
        }

        const maxVal = Math.max(...chartData.map(c => c.value)) || 100;

        return {
            countHoje: osHoje.length,
            fatHoje: formatCurrencyDisplay(faturamentoHoje),
            fatMes: formatCurrencyDisplay(faturamentoMes),
            pendente: formatCurrencyDisplay(valorPendente),
            countPendente: osPendentes.length,
            chart: chartData.map(c => ({
                ...c,
                height: Math.max(Math.round((c.value / maxVal) * 100), 8) // Mínimo de 8% p/ visual
            }))
        };
    }, [historico]);

    return (
        <div className="flex flex-col gap-4">

            {/* LINHA 1: Cards de KPI (Key Performance Indicators) */}
            <div className="grid grid-cols-3 gap-4">

                {/* Card 1: Hoje */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Hoje</p>
                            <h3 className="text-2xl font-bold text-slate-700 mt-1">{stats.fatHoje}</h3>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <TrendingUp size={12} /> {stats.countHoje} O.S. movimentadas
                    </p>
                </div>

                {/* Card 2: Mês Atual */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Este Mês</p>
                            <h3 className="text-2xl font-bold text-blue-600 mt-1">{stats.fatMes}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <CreditCard size={12} /> Acumulado Bruto
                    </p>
                </div>

                {/* Card 3: Pendente (Backlog) */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Em Aberto</p>
                            <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.pendente}</h3>
                        </div>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Hourglass size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <BarChart3 size={12} /> {stats.countPendente} aparelhos na fila
                    </p>
                </div>
            </div>

            {/* LINHA 2: Gráfico Expandido */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-40 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                        <TrendingUp size={16} /> Performance (7 Dias)
                    </h4>
                </div>

                <div className="flex-1 flex items-end gap-3">
                    {stats.chart.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end group cursor-help relative h-full">
                            {/* Barra */}
                            <div
                                className="w-full bg-slate-100 rounded-t-md group-hover:bg-blue-500 transition-all relative overflow-hidden"
                                style={{ height: `${day.height}%` }}
                            >
                                {/* Efeito de 'brilho' na barra */}
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            </div>

                            {/* Data */}
                            <span className="text-[10px] font-bold text-slate-400 text-center mt-2 group-hover:text-blue-600 transition-colors">
                                {day.day}
                            </span>

                            {/* Tooltip Flutuante */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-medium px-2 py-1.5 rounded-lg shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all pointer-events-none whitespace-nowrap z-20">
                                {formatCurrencyDisplay(day.value)}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};