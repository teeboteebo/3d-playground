/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/3d-playground/',
  plugins: [react()],
  build: {
    // the UI is one small bundle; three.js and the scene (~610 kB minified, ~160 kB gzip) load in a chunk of their own
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
