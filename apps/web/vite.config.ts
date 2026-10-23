import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, mode }) => {
  // API simulada (MSW): VITE_API_MOCK=true|false decide; sem a variável, liga em `vite`/testes e desliga em `vite build`.
  // Vira a constante `__API_MOCK__`, que o bundler resolve em tempo de build: com `false`, o MSW nem entra no pacote.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const mock = env.VITE_API_MOCK === undefined ? command === 'serve' : env.VITE_API_MOCK === 'true';

  return {
    plugins: [react()],
    define: { __API_MOCK__: JSON.stringify(mock) },
    server: {
      // Mesmo host em prod (ADR-002); em dev a API roda no `wrangler dev` (porta 8787).
      // Com a API simulada ligada (padrão no `vite`), o MSW atende /api/v1 no navegador antes do proxy.
      proxy: { '/api/v1': 'http://localhost:8787' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/testes/preparar.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
