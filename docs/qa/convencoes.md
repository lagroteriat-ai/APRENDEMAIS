# Convenções de teste (S1-QA-02)

Complementa `estrategia.md`. Cada dono escreve os testes das suas features seguindo isto.

## Comandos
| Comando | O que faz |
|---|---|
| `pnpm test` | Vitest em todos os pacotes (`api`, `web`, `ui`, `shared-types`, `test-utils`) + `node --test tests/legado` |
| `pnpm test:ci` | Igual, com relatório JUnit em `<pacote>/reports/junit.xml` (usado no CI) |
| `pnpm --filter @aprendemais/<pkg> test` | Só um pacote (`vitest run`; use `vitest` dentro da pasta para modo watch) |
| `pnpm test:e2e:install` | Baixa o Chromium do Playwright (1ª vez) |
| `pnpm test:e2e` | Playwright; sobe a landing sozinho (`:8788`). `E2E_TODOS_NAVEGADORES=1` = + Firefox, WebKit, móvel |
| `pnpm exec playwright show-report` | Abre o último relatório HTML |

## Onde ficam e como se chamam
| Tipo | Local | Nome | Ambiente |
|---|---|---|---|
| Unitário (API) | ao lado do código: `apps/api/src/**` | `<modulo>.test.ts` | workerd (Miniflare) |
| Integração (API) | `apps/api/test/` | `<area>.test.ts` (ex.: `cadastro.test.ts`) | workerd; D1/KV/R2/DO zerados por teste |
| Unitário/componente (SPA) | ao lado do código: `apps/web/src/**` | `<Nome>.test.tsx` / `<modulo>.test.ts` | jsdom + Testing Library + MSW |
| Componentes do kit | `packages/ui/src/components/` | `<Componente>.test.tsx` | jsdom |
| Schemas/contrato | `packages/shared-types/src/` | `<area>.test.ts` | node |
| E2E | `tests/e2e/` | `<jornada>.spec.ts` (smoke: `<alvo>.smoke.spec.ts`) | Chromium real |
| Landing legada | `tests/legado/` | `<tema>.test.mjs` (node:test) | node |

`describe` nomeia a unidade/rota; `it` descreve o comportamento em pt-BR (“devolve 403 para aluno de outra turma”).
Casos do critério de aceite (401/403/404/409/429, menor de idade) entram como `it` próprios.

## Utilidades
- **Dados sintéticos:** `import { fabricarAlunoMenor, fabricarCadastroAluno, fabricarLead, … } from '@aprendemais/test-utils'`
  (e-mails `@example.test`, ULIDs fixos, relógio `INSTANTE_FIXO` = 2026-10-22T12:00Z). Sem dados reais, nunca.
  `exigirSemPii(valor)` falha se achar e-mail real/CPF (use em logs e respostas de erro). Nova fábrica? Adicione ali e teste.
- **API:** `import { env, exports } from 'cloudflare:workers'`; `exports.default.fetch(new Request(...))` chama o Worker real.
  Relógio já congelado (só `Date`) em `test/setup.ts`. `test/entrada.ts` reexporta o Worker + Durable Objects.
- **Acessibilidade em componentes:** `esperarSemViolacoes(container)` (`apps/web/src/testes/axe.ts`, `packages/ui/src/test/axe.ts`).
- **E2E:** importe `test`/`expect`/`esperarSemViolacoesAxe` de `tests/e2e/base.ts`. O `test` de lá **bloqueia hosts externos**
  (hermético). Axe em toda página nova (WCAG 2.1 AA, sérias/críticas).
- Segredos de teste ficam em `apps/api/vitest.config.ts` (valores descartáveis); nunca em `.dev.vars` real.

## CI
`ci.yml`: job `verificar` (lint → typecheck → `test:ci` → build) publica `**/reports/junit.xml`; job `e2e` publica `playwright-report/`
e `reports/e2e-junit.xml` (artefatos, 14 dias). Teste que falha derruba o PR; sem `retry`.
