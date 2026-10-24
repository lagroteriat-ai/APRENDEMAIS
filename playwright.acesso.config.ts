import { defineConfig, devices } from '@playwright/test';
import { ORIGEM_WEB_LOCAL, PORTA_API, REMOTO } from './tests/e2e/acesso/constantes';

// E2E do fluxo de acesso (S1-QA-03): cadastro, consentimento, login, revogação, tokens, enumeração, papéis.
// Testes em `tests/e2e/acesso/*.spec.ts`; a landing tem a config própria (`playwright.config.ts`).
//
// Local (padrão): sobe a API (`wrangler dev` com D1/KV novos e semente, :8787) e a SPA compilada com a API real (:4173) —
//   `node scripts/e2e-acesso.mjs api|web`. A caixa de saída de e-mail (`/api/v1/dev/outbox`) entrega os links.
// Preview/staging: `E2E_BASE_URL=https://<host> pnpm test:e2e:acesso` (sem servidores locais). Os testes que precisam de
//   caixa de saída, do banco ou de IP forjado se declaram "só local" e são pulados (ver docs/qa/relatorio-sprint-01.md).
const emCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e/acesso',
  testMatch: '**/*.spec.ts',
  // Arquivos em paralelo; testes de um arquivo em sequência. Cada teste usa um IP próprio (cabeçalho CF-Connecting-IP),
  // então os limites por IP (3 falhas de login, 10 sorteios) não vazam de um teste para outro.
  fullyParallel: false,
  forbidOnly: emCI,
  retries: 0, // sem retry mascarando falha de regra (estratégia §5)
  workers: emCI ? 2 : undefined,
  outputDir: 'test-results/acesso',
  reporter: emCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/acesso' }], ['junit', { outputFile: 'reports/e2e-acesso-junit.xml' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/acesso' }]],
  use: {
    baseURL: REMOTO ?? ORIGEM_WEB_LOCAL,
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', testIgnore: '**/*.isolado.spec.ts', use: { ...devices['Desktop Chrome'] } },
    // Tempo de resposta e corrida de concorrência (`*.isolado.spec.ts`) só fazem sentido com o servidor ocioso:
    // rodam depois do projeto principal, num worker só. Sozinho: `--project=isolados --no-deps`.
    { name: 'isolados', testMatch: '**/*.isolado.spec.ts', dependencies: ['chromium'], use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: REMOTO
    ? undefined
    : [
        {
          command: 'node scripts/e2e-acesso.mjs api',
          url: `http://127.0.0.1:${PORTA_API}/api/v1/avisos-privacidade/vigentes`,
          reuseExistingServer: !emCI,
          timeout: 180_000
        },
        {
          command: 'node scripts/e2e-acesso.mjs web',
          url: ORIGEM_WEB_LOCAL,
          reuseExistingServer: !emCI,
          timeout: 240_000
        }
      ]
});
