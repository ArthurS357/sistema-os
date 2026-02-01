import type { OSHistoryItem } from '../types';

export const exportToCSV = (data: OSHistoryItem[], filename: string = 'relatorio_os.csv') => {
    if (!data || data.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }

    // 1. Cabeçalho (Header)
    const headers = [
        "OS",
        "Data",
        "Cliente",
        "Telefone",
        "Equipamento",
        "Defeito/Serviço",
        "Status",
        "Valor",
        "Observações"
    ];

    // 2. Converter Linhas
    const csvRows = data.map(item => {
        const row = [
            item.os,
            item.data,
            `"${item.cliente}"`, // Aspas para evitar quebra por vírgulas no nome
            `"${item.telefone}"`,
            `"${item.impressora}"`,
            `"${item.orcamento}"`,
            `"${item.status}"`,
            `"${item.valor}"`,
            `"${item.obs.replace(/"/g, '""')}"` // Escapar aspas internas
        ];
        return row.join(";"); // Ponto e vírgula é melhor para Excel no Brasil
    });

    // 3. Montar Conteúdo com BOM (Byte Order Mark) para acentuação correta no Excel
    const csvContent = "\uFEFF" + [headers.join(";"), ...csvRows].join("\n");

    // 4. Download Automático
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};