// TEMPORARY sandbox-only config for headless runtime verification. Deleted before commit.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 12000, allowedHosts: true, strictPort: true },
  resolve: { alias: { '@': import.meta.dirname + '/src' } },
});
