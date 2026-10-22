/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api goes to the same origin through a dev proxy. Default target is the real backend (3001);
// `npm run dev:mock` points API_TARGET at the contract mock server instead.
const target = process.env.API_TARGET ?? 'http://localhost:3001';
const noStore = { 'Cache-Control': 'no-store' }; // FE-02: protected pages are not cached by the browser

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': { target, changeOrigin: false } }, headers: noStore },
  preview: { port: 5173, strictPort: true, proxy: { '/api': { target, changeOrigin: false } }, headers: noStore },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'mock/**/*.test.ts'],
  },
});
