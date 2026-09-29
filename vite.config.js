import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// BASE_PATH exists for the one real deployment target: GitHub Pages serves this
// app from a repository sub-path (/UNI-MATEOS/). Everything PWA-related is
// derived from `base` instead of being hardcoded to "/", because otherwise the
// service worker's navigateFallback and the manifest start_url silently point
// off the deployment root and every hard load of /analytics 404s. It defaults
// to "/", so a normal local/dev build is unchanged.
const base = process.env.BASE_PATH || '/';
const baseSlash = base.endsWith('/') ? base : `${base}/`;

export default defineConfig({
  base,
  test: {
    environment: 'node',
    // Deterministic discovery: only the app's own tests, never agent worktrees.
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '.kilo/**'],
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
        start_url: baseSlash,
        display: 'standalone',
        background_color: '#07080D',
        theme_color: '#07080D',
        lang: 'en',
        orientation: 'any',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: `${baseSlash}icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: `${baseSlash}icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/icons/og-image.png'],
        navigateFallback: `${baseSlash}index.html`,
        // Deny-list paths the service worker must never answer for. Matched
        // against the full path, which now carries the deploy base, so the
        // prefixes have to be built from it rather than assumed to start at "/".
        navigateFallbackDenylist: [new RegExp(`^${baseSlash}(auth|api)`), /\.ics$/],
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
  build: {
    // Split stable vendors into cacheable groups so the entry chunk stays lean
    // and framework updates don't invalidate app-only caches (offline optimize).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router")) return "vendor-react";
          if (id.includes("/@supabase/") || id.includes("/@tanstack/")) return "vendor-data";
          if (id.includes("/framer-motion/")) return "vendor-anim";
          return undefined;
        },
      },
    },
  },
});