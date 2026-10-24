# APRENDEMAIS — Contexto do projeto

Landing page de captação de leads do **Aprende+** (plataforma educacional, público inclui menores de idade). O visitante preenche um formulário, o lead é salvo e ele é redirecionado ao protótipo externo (`PROTOTYPE_URL` em `script.js`).

## Stack
- Landing legada (raiz): HTML/CSS/JS puros, sem build próprio. Plataforma nova: monorepo **pnpm** (`apps/api`, `apps/web`, `packages/*`), TypeScript, versões em `pnpm-workspace.yaml` (`catalog:`); ver ADR-001/003.
- Hospedagem: **Cloudflare Workers** (ADR-002) + banco Cloudflare D1 (SQLite), binding `DB`. A landing é um Worker (`legacy/worker.js`): `/api/*` vai para o código, o resto sai de `dist-legacy/` (gerado de `public/` pelo `[build]` do `wrangler.toml`). Não há mais Pages Functions.
- Secrets (nunca versionar; lista e uso em `docs/devops/ambientes.md`): `ADMIN_TOKEN`, `LEAD_SECRET`, `TURNSTILE_SECRET`, `IP_HASH_SECRET`.
- Idioma da interface, mensagens e commits: português do Brasil.

## Estrutura
| Caminho | Função |
|---|---|
| `public/index.html`, `style.css`, `script.js` | Landing page e envio do formulário (fonte; `dist-legacy/` é gerado) |
| `public/admin.html`, `admin.css`, `admin.js` | Painel admin (login por token em `sessionStorage`, busca, exclusão, CSV) |
| `legacy/worker.js` | Entrypoint `fetch` do Worker da landing: roteia `/api/*` por método+caminho; 404/405 em JSON |
| `legacy/rotas/leads.js` | `POST /api/leads` — valida e faz upsert (por e-mail ou telefone) |
| `legacy/rotas/prototype-access.js` | `POST /api/prototype-access` — marca `acessou_prototipo` (exige `accessToken`) |
| `legacy/rotas/admin-leads.js` | `GET`/`DELETE` de leads, protegido por `Authorization: Bearer ADMIN_TOKEN` |
| `legacy/lib/seguranca.js`, `legacy/lib/protecao.js` | Comparação em tempo constante, HMAC do `accessToken` (`LEAD_SECRET`), Turnstile e rate limit do cadastro |
| `schema.sql`, `migrations/*.sql` | D1 **legado** (`leads`): `schema.sql` = estado atual p/ banco novo; `migrations/0001_leads_inicial.sql`+`0002_leads_email_unico.sql` = o que o wrangler aplica (a subpasta `0001_initial/` é ignorada por ele). D1 da plataforma: `db/migrations/` + `db/seeds/` (ver `docs/dados/migrar.md`) |
| `wrangler.toml` | Worker da landing por ambiente (dev/staging/prod); IDs `COLOQUE_*` são placeholders (PEN-002) |
| `apps/*/wrangler.toml`, `.github/workflows/` | Workers da API e da SPA; CI, preview por PR e deploy |
| `scripts/` | `build-legacy.mjs` (gera `dist-legacy/`), `verificar-dist.mjs`, `check-placeholders.mjs` |
| `README.md`, `docs/devops/ambientes.md` | README único; recursos, secrets, CI/CD e migrations |

## Fluxo
1. `script.js` envia `POST /api/leads` → grava no D1 e devolve `leadId`.
2. `script.js` chama `POST /api/prototype-access` com o `leadId` e redireciona ao protótipo.
3. `admin.js` consulta e exclui leads via API admin com o token.

## Convenções
- Handlers da landing são `(request, env) => Response` em `legacy/rotas/` e respondem JSON `{ ok, message, ... }` com helper `json()` local.
- Consultas SQL sempre com `prepare(...).bind(...)`.
- Conteúdo dinâmico no painel passa por `esc()` antes de entrar em `innerHTML`.
- Não colocar segredos em HTML/JS/repositório.

## Problemas conhecidos (pendentes)
- `wrangler.toml`: IDs de D1/KV/R2 são placeholders `COLOQUE_*` até alguém criar os recursos.
- Sem rate limit/captcha (Turnstile) no cadastro; upsert por `email OR telefone` pode sobrescrever dados de outro lead; sem UNIQUE no banco.
- `LIKE` na busca não escapa `%`/`_`; CSV sem proteção contra injeção de fórmulas.
- LGPD: confirmar página/aviso de privacidade e fluxo de exclusão de dados (menores de idade).
- CI existe (`.github/workflows`), mas ainda não há testes de fato; o CI não rodou no GitHub (PEN-010).

## Planejamento da plataforma (substitui o protótipo)
Objetivo: plataforma educacional de atividades gamificadas (BNCC/PE) com interfaces de aluno e professor e rankings. Trabalho por sprints, com especialistas em sessões independentes (reiniciadas a cada sprint).
- `BACKLOG.md` — versões v0.1 → v1.0 (ler só o item da tarefa).
- `ESPECIALISTAS.md` — papéis, regras de convivência e de economia de tokens, prompt-base.
- `sprints/SPRINT-NN.md` — tarefas, ondas (paralelismo) e prompts. Sprint atual: **01 (v0.1 Fundação)**.
- `COMUNICACAO.md` — mensagens, contratos, handoffs, bloqueios. `PENDENCIAS.md` — fila de pendências. `DECISOES.md` — ADRs.
- A landing/leads descrita acima continua em produção até a v1.0.

## Como rodar
- Requer Node 22+ e pnpm 12 (`corepack enable`). `pnpm install` · `pnpm dev` (API :8787 + SPA :5173) · `pnpm test` · `pnpm test:e2e:acesso` (E2E de cadastro/consentimento/login; ver `docs/qa/convencoes.md`) · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm check:wrangler`.
- Landing legada: `pnpm dev:legacy` (precisa de `.dev.vars` e de `wrangler d1 migrations apply DB --local` uma vez); `pnpm smoke:legado` valida tudo com `wrangler dev` de verdade.
- Deploy: só via GitHub Actions (`deploy.yml`: tag `v*` ou manual) com `wrangler deploy --env <amb>`; preview por PR em `preview.yml`. Detalhes: `docs/devops/ambientes.md`.
