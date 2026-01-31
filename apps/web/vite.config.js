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
    chunkSizeWarningLimit: 2000, // Aumentado para 2MB para evitar alertas falsos
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('face-api.js')) {
              return 'vendor-face-api';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('@react-google-maps')) {
              return 'vendor-maps';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            // Outras dependências menores ficam num chunk genérico ou no index se forem muito pequenas
            return 'vendor-utils'; 
          }
        }
      }
    }
  }
})
