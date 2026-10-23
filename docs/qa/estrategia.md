# Estratégia de testes — Aprende+ (S1-QA-01)

Versão 1.0 · 2026-10-22 · QA. Base: ADR-001 (Vitest, Playwright, ESLint, TS `strict`, pnpm) e ADR-002 (Workers + Static Assets). Itens marcados **(proposta)** não constam nos ADRs (ver PEN-018).

## 1. Pirâmide
| Camada | Alvo | Ferramenta | Proporção |
|---|---|---|---|
| Unitário | funções puras: `packages/shared-types` (Zod), `policy`, services, helpers (`seguranca.js`), regras de ranking/pontuação | Vitest | ~70% |
| Integração | `apps/api` com Worker real e D1/KV/R2 locais: routes → services → repos, auth, RBAC, idempotência, formato de erro | Vitest + `@cloudflare/vitest-pool-workers` (workerd/Miniflare) **(proposta)** | ~20% |
| Componente (SPA) | `packages/ui` e telas isoladas | Vitest + Testing Library (jsdom) **(proposta)** | dentro do unitário |
| E2E | jornadas críticas no navegador contra `wrangler dev` + Vite | Playwright (Chromium; WebKit e Firefox no nightly) | ~10% |
| Acessibilidade | páginas e componentes chave, WCAG 2.1 AA | `axe-core` (`@axe-core/playwright` no E2E, `vitest-axe` nos componentes) **(proposta)** + checklist manual (teclado, leitor de tela) | transversal |
| Contrato | respostas da API × OpenAPI/Zod (`{ok,data}` / `{ok:false,error}`, códigos de status do ADR-001 §3) | Vitest, schemas de `shared-types` | junto à integração |

Landing legada (congelada): testes de caracterização do Worker migrado (S1-BE-05) em integração — `POST /api/leads`, `prototype-access`, admin com/sem token. Sem E2E novo além de um smoke.

## 2. Metas de cobertura (v8, medidas no CI)
| Camada | Linhas | Ramos | Observação |
|---|---|---|---|
| `policy`, auth, sessão, idempotência, consentimento | ≥ 95% | ≥ 90% | caminho de negação testado (nega por padrão, RQ-35) |
| `services`/`repos` da API | ≥ 85% | ≥ 75% | |
| `shared-types`, helpers | ≥ 90% | ≥ 80% | |
| `apps/web` e `packages/ui` | ≥ 70% | ≥ 60% | cobertura não substitui E2E |
| E2E | — | — | 100% das jornadas críticas (login por papel, atividade do aluno, painel do professor, ranking, consentimento/exclusão) |

Cobertura é piso por pacote: queda > 2 p.p. no PR falha o CI; código novo exige ≥ 80% de linhas no diff.
## 3. Dados de teste

- **Nunca** dados pessoais reais, nem cópia/dump de produção ou dos leads da landing.
- Fixtures sintéticas determinísticas (`packages/test-utils`, semente fixa; convenções em `convencoes.md`): nomes fictícios, e-mails `@example.test`, telefones de faixa reservada, nascimento só `AAAA-MM` (RQ-02), menores e maiores de idade.
- ULIDs fixos e relógio congelado (`vi.setSystemTime`) para datas UTC e America/Recife.
- Seed de turmas/escolas/atividades via script em `db/` (só local e staging); `admin` só por seed.
- Segredos de teste descartáveis em `.dev.vars` (ignorado pelo git); nenhum segredo real em testes ou logs.
- Integração isola D1/KV por teste; E2E restaura o seed antes da suíte.
- Verificação automática: teste que falha se logs/respostas de erro contêm PII ou detalhe interno (RQ-30, RQ-32).

## 4. Ambientes

| Ambiente | Uso | Dados |
|---|---|---|
| Local (`wrangler dev` + Vite, workerd) | unit, integração, E2E de desenvolvimento | seed sintético, D1/KV/R2 locais |
| CI (runner efêmero) | todas as suítes automatizadas | seed sintético, recursos locais do Miniflare |
| Staging (`beta.`) | smoke pós-deploy, a11y manual, testes exploratórios, UAT | seed sintético; D1/KV/R2 próprios |
| Produção | somente smoke de leitura sem criar dados; monitoramento | dados reais — não testar com carga ou escrita |

## 5. Quando cada suíte roda (CI — GitHub Actions)

| Gatilho | Suítes |
|---|---|
| Local / pre-push | lint, typecheck, unitários do que mudou |
| Pull request | lint, typecheck, unitários + integração + contrato, cobertura, axe nos componentes, E2E dos fluxos críticos (Chromium), `pnpm audit` |
| Merge em `main` | tudo do PR + E2E completo + deploy staging + smoke pós-deploy |
| Nightly | E2E em 3 navegadores e viewports móveis, a11y completa, regressão visual **(proposta)**, flaky report |
| Pré-release (v0.x/v1.0) | suíte completa em staging + checklist manual de a11y e LGPD (consentimento, exclusão, menores) |

PR só funde com CI verde. Teste instável é corrigido ou quarentenado com PEN em até 1 sprint; sem `retry` mascarando falha de regra.

## 6. Critérios de aceite padrão (toda tarefa/história)

1. Critérios funcionais escritos como Dado/Quando/Então, cada um com ao menos um teste automatizado.
2. Casos negativos cobertos: validação (400), sem sessão (401), sem permissão/vínculo (403/404), conflito/idempotência (409), limite (429).
3. Autorização por papel verificada no servidor; aluno nunca acessa dado de outro aluno/turma.
4. Sem PII em logs, mensagens de erro ou URLs; textos de UI e erros em pt-BR.
5. Acessibilidade: 0 violações axe sérias/críticas; teclado completo; foco visível; contraste AA (`docs/ux/tokens.json`); responsivo de 360 px a desktop.
6. Requisitos RQ-nn aplicáveis (`docs/seguranca/lgpd-requisitos.md`) citados e testados.
7. Cobertura dentro das metas; lint e typecheck limpos; docs/OpenAPI atualizados.

## 7. Relato de defeito

Registrar em `PENDENCIAS.md` (tipo `DEFEITO`, uma linha, severidade na descrição) com detalhes numa seção/arquivo vinculado quando necessário:

```
PEN-NNN | origem | Resp. | DEFEITO | Pri. | [S1..S4] Título curto | Sprint alvo | aberta
Ambiente: local|CI|staging|prod · Commit/versão: <sha> · Navegador/SO: <se E2E>
Passos: 1… 2… 3…   Esperado: …   Obtido: …
Evidência: log com requestId (sem PII), captura/trace Playwright, teste que reproduz
Impacto: papel afetado, menor de idade? (sim/não), LGPD? (sim/não)
```

Severidade: **S1** perda/vazamento de dados, falha de segurança ou acesso indevido (→ P0) · **S2** jornada crítica quebrada sem contorno (→ P1) · **S3** falha com contorno ou a11y séria (→ P2) · **S4** cosmético (→ P3). Todo defeito corrigido ganha teste de regressão antes de fechar. Defeitos S1 envolvendo dados pessoais seguem o fluxo de incidentes do SEG.
