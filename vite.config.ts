import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // --- IMPORTANTE: Garante que o app ache os arquivos no executável ---
  base: './', 
  // -------------------------------------------------------------------

  plugins: [
    react(),
    electron([
      {
        // Configuração do Processo Principal (Main)
        entry: 'electron/main.ts',
      },
      {
        // Configuração do Preload
        entry: 'electron/preload.ts',
        onstart(options) {
          // Recarrega a página quando o preload muda
          options.reload()
        },
      },
    ]),
    // Habilita o uso de Node.js/Electron no Renderer (React)
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})