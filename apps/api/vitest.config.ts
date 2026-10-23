import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Todos os testes da API rodam dentro do workerd (Miniflare) com os bindings do wrangler.toml
// (topo = dev): D1, KV, R2 e o Durable Object ficam locais e isolados por teste.
// Convenção: unitários ao lado do código (`src/**/*.test.ts`), integração em `test/**/*.test.ts`.
export default defineConfig(async () => {
  // As migrations do DAD (db/migrations) são aplicadas em test/setup.ts, a partir deste binding.
  const migrations = await readD1Migrations('../../db/migrations');
  return {
    plugins: [
      cloudflareTest({
        // O entrypoint de teste reexporta o Worker e as classes de Durable Object.
        main: './test/entrada.ts',
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // Segredos descartáveis; nunca usar valores reais aqui.
          bindings: {
            TEST_MIGRATIONS: migrations,
            TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
            IP_HASH_SECRET: 'teste-ip-hash-secret-0123456789abcdef',
            APP_SECRET: 'teste-app-secret-0123456789abcdef0123456789',
            // Reduz o custo do Argon2id nos testes (env.ts).
            ARGON2_M_KIB: '8',
            ARGON2_T: '1',
            SEM_ALARME_LIMITADOR: '1'
          }
        }
      })
    ],
    test: {
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts']
    }
  };
});
