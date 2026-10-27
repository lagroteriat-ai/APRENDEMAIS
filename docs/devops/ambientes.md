# Ambientes e deploy (Workers — ADR-002)

Tudo roda em Cloudflare **Workers**; não há projeto Pages. Cada Worker tem 3 ambientes no próprio `wrangler.toml`
(topo = dev local; `[env.staging]`; `[env.production]`). Bindings **não são herdados**: cada env os repete.

| Worker | Config | dev / staging / produção | Bindings |
|---|---|---|---|
| Landing legada | `wrangler.toml` (raiz) | `aprende-mais-dev` / `-staging` / `aprende-mais` | `DB` (D1 leads) |
| API (Hono) | `apps/api/wrangler.toml` | `aprende-mais-api-dev` / `-staging` / `aprende-mais-api` | `DB`, `KV`, `R2` |
| SPA | `apps/web/wrangler.toml` | `aprende-mais-web-dev` / `-staging` / `aprende-mais-web` | só estáticos |

## 1. Placeholders (PEN-002)
Todo ID real é `COLOQUE_*` no repositório. `node scripts/check-placeholders.mjs <staging|production>` lista o que falta;
deploy e preview recusam rodar com pendências. IDs de D1/KV não são segredos, mas só entram no commit depois de criados.

## 2. Criar recursos (uma vez por ambiente; troque `staging` por `prod`/`dev`)
```
pnpm exec wrangler d1 create aprendemais-staging                  # API → database_id
pnpm exec wrangler d1 create APRENDEMAIS_LEADS_STAGING            # legada → database_id
pnpm exec wrangler kv namespace create aprendemais-sessoes-staging # → id do KV
pnpm exec wrangler r2 bucket create aprendemais-midia-staging     # bucket já tem nome no toml
```
Produção da legada: o D1 `APRENDEMAIS_LEADS` já existe — copie o ID no painel (Workers & Pages → D1). Cole cada ID no
`wrangler.toml` do env correspondente. Tabela da legada: `wrangler d1 execute APRENDEMAIS_LEADS_STAGING --remote --file schema.sql`.

## 3. Secrets (nunca no repositório; sem valores aqui)
| Secret | Worker | Para quê | Gerar |
|---|---|---|---|
| `ADMIN_TOKEN` | legada | senha do painel `/admin.html` | `openssl rand -hex 24` |
| `LEAD_SECRET` | legada | assina o `accessToken` do lead | `openssl rand -hex 32` |
| `TURNSTILE_SECRET` | api (e legada, SEG-03) | valida o CAPTCHA | painel Cloudflare → Turnstile |
| `IP_HASH_SECRET` | api | HMAC do IP em `consentimentos.ip_hash` (PEN-028) **e** das chaves dos contadores de rate limit; distinto por ambiente | `openssl rand -hex 32` |
| `APP_SECRET` | api | HMAC do `apelidoToken` (≥ 32 caracteres); distinto por ambiente | `openssl rand -hex 32` |

Variáveis da API (não secretas, em `apps/api/wrangler.toml`, repetidas por ambiente): `ALLOWED_ORIGINS` (origens extras para POST/PUT/DELETE;
a própria origem sempre vale), `APP_BASE_URL` (base dos links dos e-mails; `COLOQUE_URL_APP_*` até haver domínio) e `TURNSTILE_OBRIGATORIO`
(`true` em staging/produção). A API também declara o Durable Object `Limitador` (contadores atômicos) e sua migration `v1` em cada ambiente.
**E-mail:** ainda não há provedor (PEN-047). Falha fechada (PEN-056): só `ENVIRONMENT=dev` usa a caixa de saída no KV (`GET /api/v1/dev/outbox`);
staging, produção e qualquer valor desconhecido só registram `email_provedor_nao_configurado`. Logo, o cadastro de menor (e-mail ao responsável) não se valida em staging até o PEN-047.
**Retenção:** Cron Trigger diário (03:17 UTC), declarado em `[triggers]` de cada ambiente em `apps/api/wrangler.toml`, roda `src/retencao.ts`; o log traz só contagens.
**CPU:** o Argon2id (m=19 MiB, t=2) custa ≈ 230 ms de CPU por login/cadastro; exige plano Workers **Paid** (o Free limita a 10 ms).

**Turnstile da landing (SEG-03 / PEN-004):** crie um widget por ambiente no painel (Turnstile → Add widget; domínios do Worker/staging/prod).
O **secret key** vai em `TURNSTILE_SECRET` (acima). A **site key** (pública) entra no build: `TURNSTILE_SITEKEY=<chave> pnpm build:legacy`
(*build variable* do Workers Builds de cada Worker da landing, não secret). Sem ela o build usa a chave de teste da Cloudflare e avisa;
com secret real isso bloqueia o cadastro, então **não publique sem a variável**. Sem `TURNSTILE_SECRET` o `POST /api/leads` responde 500.
Rate limit: binding `RATE_LIMITER` (5 req/60 s por IP) já declarado em `wrangler.toml` (`namespace_id` 1001/1002/1003); não exige criação. Os contadores são por localização da Cloudflare (aproximado).
Dev local: secret de teste `1x0000000000000000000000000000000AA` (sempre passa) com a site key `1x00000000000000000000AA`.

`pnpm exec wrangler secret put NOME --env staging` (rode na pasta do Worker). Local: `.dev.vars` (copie de `.dev.vars.example`).

## 4. CI/CD: verificação no GitHub Actions, deploy 100% no Workers Builds
- `ci.yml` (único workflow) — PR e `main`: install congelado → lint → typecheck → test (inclui `tests/legado`, PEN-037) → build →
  `check:wrangler` → smoke da landing → `gerar-curriculo.mjs --check` + migrations e seed do zero em D1 local (PEN-039) → e2e.
  **Não há GitHub Actions de deploy**, sem token da Cloudflare no GitHub.
- **Workers Builds** (painel: Workers & Pages → Worker → Settings → Builds → *Connect*): um Worker conectado por ambiente, 6 no total.
  O Workers Builds **não espera o CI**: em GitHub → Settings → Branches, proteja `main` e `producao` exigindo o job "lint · typecheck · test · build" e PR.
- Fluxo de branches: PR → Preview URL; merge em `main` → **staging**; promover `main` para a branch `producao` (PR `main` → `producao`) → **produção**.

| Worker (nome exato) | Root directory | Production branch | Deploy command | Non-production branch command |
|---|---|---|---|---|
| `aprende-mais-staging` | `/` | `main` | `node scripts/deploy.mjs staging` | `node scripts/deploy.mjs staging --versao` |
| `aprende-mais-api-staging` | `/apps/api` | `main` | `node ../../scripts/deploy.mjs staging` | `node ../../scripts/deploy.mjs staging --versao` |
| `aprende-mais-web-staging` | `/apps/web` | `main` | `node ../../scripts/deploy.mjs staging` | `node ../../scripts/deploy.mjs staging --versao` |
| `aprende-mais` | `/` | `producao` | `node scripts/deploy.mjs production` | desligar builds de branches não-produção |
| `aprende-mais-api` | `/apps/api` | `producao` | `node ../../scripts/deploy.mjs production` | desligar |
| `aprende-mais-web` | `/apps/web` | `producao` | `node ../../scripts/deploy.mjs production` | desligar |

- `scripts/deploy.mjs` é a única forma aceita no campo *Deploy command*: **recusa** rodar sem `staging|production` (o topo do `wrangler.toml` é DEV
  e nunca vai ao ar), recusa placeholders `COLOQUE_*` do ambiente e só então chama `wrangler deploy|versions upload --env X`. `check:wrangler`
  (CI) garante `workers_dev=false`/`preview_urls=false` no topo dos três `wrangler.toml` e que o guard recusa `--env` ausente/inválido.
- *Build command*: vazio para landing (o `[build]` do `wrangler.toml` gera `dist-legacy/`) e API; `pnpm --filter @aprendemais/web build` para a SPA.
  O Workers Builds instala com pnpm pelo `pnpm-lock.yaml`; se ignorar o `.nvmrc`, defina a build variable `NODE_VERSION=24`.
- *Build variables* (não são secrets de runtime): `TURNSTILE_SITEKEY` (chave pública, só nos Workers da landing; por ambiente). Secrets de runtime seguem em `wrangler secret put` (§3).
- *Build watch paths* (evita rebuild cruzado; confirmar a sintaxe no painel): landing `wrangler.toml, legacy/**, public/**, scripts/**`; API `apps/api/**, packages/**, db/**, pnpm-lock.yaml`; SPA `apps/web/**, packages/**, pnpm-lock.yaml`.
- **Bootstrap:** o Worker precisa existir antes de conectar. Com `wrangler login` e IDs reais commitados, rode **uma vez** em cada pasta
  `node [../../]scripts/deploy.mjs staging` (e `production`), depois conecte o repositório no painel. Sem domínio, URLs `workers.dev` (§6).
- **Migrations não rodam no deploy** (§5): aplique antes de promover.

## 5. Migrations D1 (manual, antes do deploy que as usa)
```
pnpm exec wrangler d1 migrations apply aprendemais-staging --env staging --remote   # em apps/api (db/migrations)
```
Depois das migrations, o seed do catálogo: `pnpm exec wrangler d1 execute aprendemais-staging --env staging --remote --file ../../db/seeds/curriculo.sql` (`docs/dados/migrar.md` § Seeds).
Legada: `migrations/` na raiz (`APRENDEMAIS_LEADS*`). Produção: aplicar só após validar em staging e fazer backup (`d1 export`).

SR-21: `scripts/verificar-dist.mjs` (parte do `pnpm build`) falha se `dist-legacy/` ou `apps/web/dist/` tiverem docs, SQL, configs ou segredos.

## 6. Rotas no mesmo host (a validar com domínio real)
`/api/v1/*` → Worker da API; o resto → Worker da SPA (rota mais específica vence). Comentários nos `wrangler.toml`
mostram o `routes`. Sem domínio (workers.dev/preview), a SPA não alcança a API por caminho relativo; em dev o Vite faz proxy.

## 7. Pendências
Domínio/zona (PEN-033); IDs reais (PEN-002); desligar `workers_dev` em produção após o domínio; provedor de e-mail (PEN-047); revisar `observability`/logs (RQ-30).

## 8. Passos humanos que faltam (valores nunca no repositório)
Em ordem; cada um destrava o seguinte. Estado verificado em 2026-10-26: `wrangler whoami` = não autenticado; `check-placeholders staging` = 4 pendências.
1. `pnpm exec wrangler login` na máquina de quem opera (ou `CLOUDFLARE_API_TOKEN` local); confirmar plano Workers **Paid** e ativar R2 na conta.
2. **PEN-002 — criar recursos de staging** (§2): `d1 create aprendemais-staging`, `d1 create APRENDEMAIS_LEADS_STAGING`, `kv namespace create aprendemais-sessoes-staging`, `r2 bucket create aprendemais-midia-staging`.
   Colar os IDs em `COLOQUE_ID_D1_API_STAGING`, `COLOQUE_ID_KV_API_STAGING` (`apps/api/wrangler.toml`) e `COLOQUE_ID_D1_LEGADO_STAGING` (`wrangler.toml`). Produção: o mesmo, com `…_PROD` (D1 legado `APRENDEMAIS_LEADS` já existe: copiar o ID no painel).
3. **Migrations + seed** em staging (§5) e `d1 execute APRENDEMAIS_LEADS_STAGING --remote --file schema.sql` ou `migrations apply` na raiz.
4. **Secrets** (§3, `wrangler secret put NOME --env staging` em cada pasta): API `TURNSTILE_SECRET`, `IP_HASH_SECRET`, `APP_SECRET`; landing `ADMIN_TOKEN`, `LEAD_SECRET`, `TURNSTILE_SECRET`. Valores distintos por ambiente.
5. **PEN-037/045 — Turnstile:** criar um widget por ambiente; secret key no passo 4; site key em `TURNSTILE_SITEKEY` (build variable da landing) e `VITE_TURNSTILE_SITE_KEY` (build variable da SPA).
6. **Bootstrap + Workers Builds** (§4): 1º deploy manual de cada Worker de staging, conectar os 3 ao repositório (tabela do §4), branch protection em `main`/`producao`, criar a branch `producao`.
7. **PEN-033 — domínio:** definir zona; descomentar `routes` (`DOMINIO/api/v1/*` → API, `DOMINIO/*` → SPA), preencher `COLOQUE_URL_APP_*`, depois `workers_dev=false` em produção.
8. **PEN-047 — e-mail:** escolher provedor, implementar `ProvedorEmail` e guardar a chave como secret. Sem isso, nada de dado real de menor.
