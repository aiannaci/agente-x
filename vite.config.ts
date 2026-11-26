import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker propio (src/sw.ts) para recibir las notificaciones push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'badge-96.png'],
      manifest: {
        name: 'Agente X',
        short_name: 'Agente X',
        description: 'Recordatorios de informes y tareas',
        lang: 'es-AR',
        theme_color: '#3B4BDB',
        background_color: '#0E1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
} as any)
