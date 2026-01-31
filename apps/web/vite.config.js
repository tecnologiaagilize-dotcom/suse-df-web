import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Preserva nomes para evitar erro "H is not a function" em produção
    keepNames: true
  },
  build: {
    rollupOptions: {
      output: {
        // Deixando o Vite gerenciar os chunks automaticamente para evitar erros de referência
      }
    }
  }
})
