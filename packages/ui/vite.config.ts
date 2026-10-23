import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Serve a página de exemplo (`pnpm playground` → /playground/) e roda os testes (jsdom).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // já no .gitignore
    rollupOptions: { input: 'playground/index.html' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
