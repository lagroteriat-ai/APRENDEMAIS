# Aprende+

Plataforma educacional de atividades gamificadas (BNCC/PE) para alunos, professores e responsáveis — o público inclui
menores de idade. Este repositório tem duas partes que convivem até a v1.0:

- **Plataforma nova** (monorepo pnpm, em construção): `apps/api` (Worker, Hono), `apps/web` (SPA React + Vite),
  `packages/ui`, `packages/shared-types`.
- **Landing de leads legada** (na raiz, congelada): formulário que grava o lead no D1 e envia ao protótipo externo.

Hospedagem 100% **Cloudflare Workers** (ADR-002): D1, KV e R2; sem Pages.

## Requisitos
Node 22+ (`.nvmrc` = 24) e pnpm 12 (`corepack enable` instala a versão de `packageManager`).

## Comandos
| Comando | O que faz |
|---|---|
| `pnpm install` | instala o workspace |
| `pnpm dev` | API (`wrangler dev`, :8787) + SPA (Vite, :5173, proxy `/api/v1` → API) |
| `pnpm dev:legacy` | landing legada local (`wrangler dev`, estáticos de `dist-legacy/`) |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | qualidade (os mesmos passos do CI) |
| `pnpm build` | gera `dist-legacy/` e builda api, web e pacotes |
| `pnpm check:wrangler` | `wrangler deploy --dry-run` de todos os Workers em staging/produção |

`pnpm i && pnpm build` funciona do zero. Os pacotes `packages/*` são consumidos direto do código-fonte (sem build próprio).

## Estrutura
| Caminho | Função |
|---|---|
| `apps/api`, `apps/web`, `packages/*` | plataforma nova (ADR-001) |
| `index.html`, `style.css`, `script.js`, `admin.*` | landing legada e painel de leads |
| `functions/` | API da landing no formato Pages Functions — migra para Worker na S1-BE-05 |
| `wrangler.toml` | config do Worker da landing (dev/staging/produção) |
| `schema.sql`, `migrations/` | tabela `leads` (manter os dois em sincronia) |
| `scripts/` | `build-legacy.mjs` (gera `dist-legacy/`), `check-placeholders.mjs` |
| `docs/`, `data/` | segurança/LGPD, UX, QA, DevOps, currículo |
| `BACKLOG.md`, `sprints/`, `DECISOES.md`, `COMUNICACAO.md`, `PENDENCIAS.md`, `ESPECIALISTAS.md` | planejamento |

## Ambientes, recursos e deploy
Veja [docs/devops/ambientes.md](docs/devops/ambientes.md): criação de D1/KV/R2, secrets (`ADMIN_TOKEN`, `LEAD_SECRET`,
`TURNSTILE_SECRET`), CI/CD e migrations. Os IDs ainda são placeholders `COLOQUE_*` (PEN-002).

**Nunca versione segredos.** Em desenvolvimento local use `.dev.vars` (copie de `.dev.vars.example`).

## Landing legada
Só os arquivos públicos vão para o Worker: `pnpm build:legacy` copia a landing e o painel para `dist-legacy/`
(o restante do repositório — `docs/`, `apps/`, planejamento — nunca é publicado; PEN-016).

Fluxo: o visitante preenche o formulário → `POST /api/leads` valida e grava (upsert por e-mail/telefone) e devolve
`leadId` + `accessToken` → `POST /api/prototype-access` registra o acesso → redireciona ao protótipo (`PROTOTYPE_URL`
em `script.js`). O painel `/admin.html` usa `ADMIN_TOKEN` (`GET`/`DELETE /api/admin/leads`); em produção, considere
também o Cloudflare Access.

Até a S1-BE-05 a API da landing existe apenas em `functions/` (Pages Functions): o Worker legado serve só os estáticos
e `/api/*` não responde nele. Por isso o deploy da legada é sempre explícito (alvo `legada`).

## Privacidade (LGPD)
O Aprende+ pode envolver menores de idade: colete só o necessário e mantenha o aviso de privacidade publicado. O
formulário exige aceite explícito. Requisitos em [docs/seguranca/lgpd-requisitos.md](docs/seguranca/lgpd-requisitos.md).
