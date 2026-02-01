import { useEffect } from 'react';

interface ShortcutsProps {
    onSave: () => void;
    onPrint: () => void;
    onNew: () => void;
    onSearchFocus: () => void;
}

export const useShortcuts = ({ onSave, onPrint, onNew, onSearchFocus }: ShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignora se for tecla de sistema que não queremos bloquear, mas 
            // PREVINE o padrão do navegador para nossos atalhos (ex: Ctrl+P não abrir a janela de print do Chrome)

            // F2: Nova OS (Padrão em muitos sistemas comerciais)
            if (e.key === 'F2') {
                e.preventDefault();
                onNew();
                return;
            }

            // Ctrl + S: Salvar
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                onSave();
                return;
            }

            // Ctrl + P: Salvar e Imprimir
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                onPrint();
                return;
            }

            // Ctrl + F ou F3: Focar Busca
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') || e.key === 'F3') {
                e.preventDefault();
                onSearchFocus();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSave, onPrint, onNew, onSearchFocus]);
};