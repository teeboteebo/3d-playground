/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/3d-playground/',
  plugins: [react()],
  build: {
    // three.js r128 alone is ~600 kB minified; the whole app is one ~210 kB gzip bundle.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
