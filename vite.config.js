import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{js,jsx}'],
      exclude: ['src/__tests__/**', 'src/lib/**/*.test.js'],
      reporter: ['text', 'json', 'html'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/pwa-192x192.png', 'icons/pwa-512x512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'UNI\u00b7MATE \u2014 Academic OS',
        short_name: 'UNI\u00b7MATE',
        description: 'Your university, organized around you. The personal academic operating system \u2014 installable, offline-first, dark by design.',
        start_url: '/',
        display: 'standalone',
        background_color: '#07080D',
        theme_color: '#07080D',
        lang: 'en',
        orientation: 'any',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/icons/og-image.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth/, /^\/api/, /\.ics$/],
        runtimeCaching: [
          {
            // Keep Supabase/Hosted API traffic runtime-cached (stale-while-revalidate)
            // so the HUD still renders previously-loaded data while offline.
            urlPattern: ({ url }) => url.hostname === 'supabase.co',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'unimate-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
    },
  },
});