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
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Larder — Meal Prep Inventory',
        short_name: 'Larder',
        description: 'Track prepped and portioned meals in storage',
        theme_color: '#f2f2f7',
        background_color: '#f2f2f7',
        display: 'standalone',
        orientation: 'any',
        // vite-plugin-pwa injects '/' even when omitted, so keep it explicit;
        // installed apps always launch at the phone home screen and the kiosk
        // is reached via its in-app link (see README).
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
