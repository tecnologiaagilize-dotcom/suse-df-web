import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Tentar registro automático
      devOptions: {
        enabled: true
      },
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
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Aumentado para 10MB (Modelos TF)
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-libs',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 ano
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: ['@tensorflow/tfjs', '@tensorflow-models/speech-commands'],
      output: {
        globals: {
          '@tensorflow/tfjs': 'tf',
          '@tensorflow-models/speech-commands': 'speechCommands'
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('face-api.js')) {
              return 'vendor-face-api';
            }
            return 'vendor'; 
          }
        }
      }
    }
  }
})
