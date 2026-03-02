import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'SUSE-DF Emergência',
        short_name: 'SUSE-DF',
        description: 'Sistema Unificado de Segurança e Emergência do Distrito Federal',
        theme_color: '#dc2626', // Vermelho emergência
        background_color: '#1f2937', // Cinza escuro
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12MB para acomodar WASM de 11MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mjs,onnx}'],
        runtimeCaching: [
          {
            // Cache para tiles do mapa (OpenStreetMap) para funcionar offline
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Estratégia para API (Background Sync seria ideal aqui, mas requer SW customizado)
            // Para 'generateSW', vamos garantir que não cacheie API calls críticas
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkOnly',
            options: {
                backgroundSync: {
                    name: 'supabase-queue',
                    options: {
                        maxRetentionTime: 24 * 60 // Tentar reenviar por 24 horas
                    }
                }
            }
          }
        ]
      }
    })
  ],
  esbuild: {
    // Preserva nomes para evitar erro "H is not a function" em produção
    keepNames: true
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Isola Face API (pesado)
            if (id.includes('face-api.js')) {
              return 'vendor-face-api';
            }
            // Agrupa todo o resto para evitar erros de dependência circular
            return 'vendor'; 
          }
        }
      }
    }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
