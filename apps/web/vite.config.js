import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react( ),
    nodePolyfills(), // Adiciona os polyfills necessários para módulos do Node como 'util'
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'SUSE-DF Emergência',
        short_name: 'SUSE-DF',
        description: 'Sistema Unificado de Segurança e Emergência do Distrito Federal',
        theme_color: '#dc2626',
        background_color: '#1f2937',
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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // Aumenta limite para 6MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkOnly',
            options: {
                backgroundSync: {
                    name: 'supabase-queue',
                    options: {
                        maxRetentionTime: 24 * 60
                    }
                }
            }
          }
        ]
      }
    } )
  ],
  esbuild: {
    keepNames: true
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Isola apenas o face-api.js por ser muito grande e específico
            if (id.includes('face-api.js')) {
              return 'vendor-face-api';
            }
            // Mantém todas as outras dependências juntas para evitar erros de ordem de importação/referência circular
            return 'vendor'; 
          }
        }
      }
    }
  }
})
