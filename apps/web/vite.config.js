import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@tensorflow/tfjs-core': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-core'),
      '@tensorflow/tfjs-converter': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-converter'),
      '@tensorflow/tfjs-data': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-data'),
      '@tensorflow/tfjs-layers': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-layers'),
      '@tensorflow/tfjs-backend-webgl': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-backend-webgl'),
      '@tensorflow/tfjs-backend-cpu': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs-backend-cpu'),
    }
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-data',
      '@tensorflow/tfjs-layers',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow-models/speech-commands'
    ]
  },
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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
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
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkOnly',
            options: {
                backgroundSync: {
                    name: 'supabase-queue',
                    options: {
                        maxRetentionTime: 24 * 60 // 24 horas
                    }
                }
            }
          }
        ]
      }
    })
  ],
  esbuild: {
    keepNames: true
  },
  build: {
    commonjsOptions: {
      include: [/node_modules\/@tensorflow/, /node_modules\/@tensorflow-models/]
    },
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].${Date.now()}.js`,
        chunkFileNames: `assets/[name].${Date.now()}.js`,
        assetFileNames: `assets/[name].[ext]`,
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
