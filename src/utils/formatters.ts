// Converte "1234.56" ou "R$ 1.234,56" para o número 1234.56
export const parseCurrency = (value: string): number => {
    if (!value) return 0;
    // Remove tudo que não é número ou vírgula/ponto/traço
    const clean = value.replace(/[^0-9,-]+/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
};

// Converte o número 1234.56 para "R$ 1.234,56" (Input do usuário)
export const formatCurrencyInput = (value: string): string => {
    let v = value.replace(/\D/g, "");
    v = (parseInt(v) / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return v === "NaN" ? "" : `R$ ${v}`;
};

// Converte número puro para formato de exibição BRL
export const formatCurrencyDisplay = (value: number): string => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Máscara de Telefone (10 ou 11 dígitos)
export const formatPhone = (value: string): string => {
    const v = value.replace(/\D/g, "").substring(0, 11);
    if (v.length > 10) return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
    if (v.length > 6) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    if (v.length > 2) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    return v;
};

// Limpa telefone para links (WhatsApp)
export const cleanPhone = (value: string): string => {
    return value.replace(/\D/g, '');
};