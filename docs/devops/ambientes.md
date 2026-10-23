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
| `IP_HASH_SECRET` | api | HMAC do IP em `consentimentos.ip_hash` (PEN-028); distinto por ambiente | `openssl rand -hex 32` |

**Turnstile da landing (SEG-03 / PEN-004):** crie um widget por ambiente no painel (Turnstile → Add widget; domínios do Worker/staging/prod).
O **secret key** vai em `TURNSTILE_SECRET` (acima). A **site key** (pública) entra no build: `TURNSTILE_SITEKEY=<chave> pnpm build:legacy`
(variável do GitHub Environment `staging`/`production`, não secret). Sem ela o build usa a chave de teste da Cloudflare e avisa;
com secret real isso bloqueia o cadastro, então **não publique sem a variável**. Sem `TURNSTILE_SECRET` o `POST /api/leads` responde 500.
Rate limit: binding `RATE_LIMITER` (5 req/60 s por IP) já declarado em `wrangler.toml` (`namespace_id` 1001/1002/1003); não exige criação. Os contadores são por localização da Cloudflare (aproximado).
Dev local: secret de teste `1x0000000000000000000000000000000AA` (sempre passa) com a site key `1x00000000000000000000AA`.

`pnpm exec wrangler secret put NOME --env staging` (rode na pasta do Worker). Local: `.dev.vars` (copie de `.dev.vars.example`).

## 4. CI/CD (`.github/workflows`)
- `ci.yml` — PR e `main`: install congelado → lint → typecheck → test → build → `check:wrangler` (dry-run staging/prod).
- `preview.yml` — por PR: `wrangler versions upload --env staging --preview-alias pr-N` (api, web, legada); resumo traz as URLs.
  Pula (aviso, sem falhar) se faltarem credenciais ou houver placeholders de staging. Não promove tráfego.
- `deploy.yml` — **só** tag `v*` (produção: api + web) ou manual (ambiente e alvo). Roda o CI antes e bloqueia placeholders.
  A landing legada só publica com alvo `legada` (até S1-BE-05 ela não tem `/api/*`).
- GitHub → Settings → Environments: `staging` e `production` (com revisor obrigatório), cada um com os secrets
  `CLOUDFLARE_API_TOKEN` (permissões: Workers Scripts, D1, KV, R2 — Edit) e `CLOUDFLARE_ACCOUNT_ID`.
- **Bootstrap:** `versions upload` exige o Worker existente → faça o 1º `deploy.yml` manual em `staging` antes dos previews.

## 5. Migrations D1 (manual, antes do deploy que as usa)
```
pnpm exec wrangler d1 migrations apply aprendemais-staging --env staging --remote   # em apps/api (db/migrations)
```
Legada: `migrations/` na raiz (`APRENDEMAIS_LEADS*`). Produção: aplicar só após validar em staging e fazer backup (`d1 export`).

SR-21: `scripts/verificar-dist.mjs` (parte do `pnpm build`) falha se `dist-legacy/` ou `apps/web/dist/` tiverem docs, SQL, configs ou segredos.

## 6. Rotas no mesmo host (a validar com domínio real)
`/api/v1/*` → Worker da API; o resto → Worker da SPA (rota mais específica vence). Comentários nos `wrangler.toml`
mostram o `routes`. Sem domínio (workers.dev/preview), a SPA não alcança a API por caminho relativo; em dev o Vite faz proxy.

## 7. Pendências
Domínio/zona; IDs reais; S1-BE-05 (entrypoint da legada); desligar `workers_dev` em produção; revisar `observability`/logs (RQ-30).
