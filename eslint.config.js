import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.wrangler/**',
    'dist-legacy/**',
    // Saídas de teste (Vitest JUnit, Playwright HTML/traces): geradas, nunca lintar.
    '**/reports/**',
    'playwright-report/**',
    'test-results/**',
    // Gerado pelo `msw init` (service worker da API simulada); não é código do projeto.
    'apps/web/public/mockServiceWorker.js',
    // Front-end da landing legada (congelado até a v1.0; só correções de segurança/LGPD). O Worker dela (legacy/) é lintado.
    'public/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['legacy/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/scripts/**/*.mjs', 'db/**/*.mjs', '*.config.{js,ts}', '**/*.config.{js,ts,mjs}', 'tests/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // `const { a, ...resto } = obj` para omitir um campo é idiomático em testes.
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
]);
