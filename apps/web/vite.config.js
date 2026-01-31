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
    chunkSizeWarningLimit: 1000, // Aumenta o limite do aviso para 1MB (opcional, mas ajuda)
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-maps': ['leaflet', 'react-leaflet', '@react-google-maps/api'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-face-api': ['face-api.js'],
          'vendor-ui': ['lucide-react']
        }
      }
    }
  }
})
