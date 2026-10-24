# Relatório QA — Sprint 1 · S1-QA-03 (E2E do fluxo de acesso)

2026-10-23 · QA · Ambiente **local**: API `wrangler dev` 4.152 (D1/KV novos + semente) e SPA compilada em `vite preview`; Chromium 156. Commit: n/d (git fora do PATH). **Staging/preview real não existe ainda** (PEN-002/034, PEN-068).

## Resultado
`pnpm test:e2e:acesso`: **63 testes em 8 arquivos — 57 verdes, 4 falhas esperadas (`test.fail`, defeitos abertos), 2 puladas**; ~1 min. 8 rodadas seguidas com servidor novo, sem instabilidade (no caminho, 3 ruídos de teste corrigidos). Lint e tsc limpos. Os testes de tempo, de corrida e que escrevem no banco local rodam por último, isolados (`*.isolado.spec.ts`).

## Cobertura
| Jornada | Verificado | Resultado |
|---|---|---|
| Aluno ≥18 | cadastro → e-mail mascarado → bloqueado → E3 → login (apelido e e-mail); link de uso único; correção de e-mail; SR-03/SR-10 | ok |
| Aluno <18 | cadastro → bloqueado (rota, login, reload, sessão pendente 403, AB3) → E1 → T06/T07 → login; recusa apaga; mês dos 18 = menor | ok; reenvio pela tela: PEN-067 |
| Revogação | API: estado, revoga, protocolo, ≤15 d, idempotente, sessão cai na hora (SR-06), conta em exclusão, sem ranking (RQ-21) | ok; **tela T08 não existe** (PEN-043) |
| Tokens e sessão | desconhecido, truncado, usado e vencido (consentimento, e-mail, recuperação, convite) indistinguíveis; sessão vencida no KV; recuperação do menor vai ao responsável e derruba sessões | ok |
| Enumeração | login e recuperação (resposta e tempo, SR-08), cadastro com e-mail existente (DC-05), SR-09, SR-13 | ok; F-03 reproduzido |
| Papéis | aluno × professor (tela e API), papel só do banco, 401 sem cookie ou forjado, pendente × completa, CSRF, cookie (SR-04/05/07), no-store e erros (SR-16/19), sem PII no storage | ok |
| Acessibilidade | axe WCAG 2.1 AA (0 sérias/críticas) em ~25 telas e estados; 360 px sem rolagem; só teclado; foco no resumo de erros; diálogo com Esc | ok |

## Defeitos (passos de reprodução em `PENDENCIAS.md`)
| ID | Sev. | Resumo |
|---|---|---|
| F-01 (BLOQUEIO) | S1 | 30 logins errados em paralelo → 30× 401, 0× 428: SR-09 não vale sob concorrência. Reproduzido |
| PEN-067 | S2 | "Sair" e "Reenviar e-mail" sem corpo levam 403; a sessão segue válida no servidor (S1 se confirmar em staging) |
| PEN-053 | S2 | Reenvio logo após o cadastro: 429 (e-mail novo) × 202 (existente) revela conta |
| PEN-052 | S2 | Sem CSP/HSTS/Referrer-Policy na SPA (SR-18); o teste já existe e roda com `E2E_BASE_URL` |

## Não coberto
- Staging/preview: o `/dev/outbox` só existe com `ENVIRONMENT=dev` e o cadastro exige Turnstile lá (PEN-068). Testes de limite por IP são "só local" (a Cloudflare sobrescreve o IP).
- Prazos reais (7 d, 30 min, 30 d) são simulados no banco/KV; "10 falhas → 429" exige Turnstile válido (fica no teste de integração da API); exclusão em ≤15 d (cron) e e-mail real (PEN-047).
- Não existem T08 (teste em `fixme`), T11 (professor testado pela API), ranking; Firefox/WebKit/móvel só no nightly.
- Argon2id reduzido na API de teste: o SR-08 compara caminhos de código, não o custo de produção.

## Como rodar
`pnpm test:e2e:install` (1ª vez) · `pnpm test:e2e:acesso` · `E2E_BASE_URL=https://… pnpm test:e2e:acesso` · `pnpm exec playwright show-report playwright-report/acesso`. Convenções: `docs/qa/convencoes.md`.
