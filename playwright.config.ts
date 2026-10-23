import { defineConfig, devices } from '@playwright/test';

// E2E (docs/qa/estrategia.md §1/§5). Testes em `tests/e2e/*.spec.ts`.
// A landing é servida pelo Worker legado (wrangler dev + dist-legacy/) em porta própria, para não colidir
// com `pnpm dev` (API :8787, SPA :5173). Quando a SPA tiver jornadas, adicione um 2º `webServer` e um `project`.
const PORTA_LANDING = 8788;
const emCI = !!process.env.CI;
// Nightly: E2E_TODOS_NAVEGADORES=1 roda também Firefox, WebKit e viewport móvel.
const todos = !!process.env.E2E_TODOS_NAVEGADORES;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: emCI,
  retries: 0, // sem retry mascarando falha de regra (estratégia §5)
  workers: emCI ? 2 : undefined,
  reporter: emCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'reports/e2e-junit.xml' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA_LANDING}`,
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(todos
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }
        ]
      : [])
  ],
  webServer: {
    command: `pnpm build:legacy && pnpm exec wrangler dev --port ${PORTA_LANDING}`,
    url: `http://localhost:${PORTA_LANDING}`,
    reuseExistingServer: !emCI,
    timeout: 120_000
  }
});
