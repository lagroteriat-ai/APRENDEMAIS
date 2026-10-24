# Runbook de operação (staging/produção)

Rode os comandos na pasta do Worker (`apps/api`, `apps/web` ou a raiz = landing) com `pnpm exec wrangler … --env <staging|production>`.
Autenticação: `wrangler login` (uso pessoal) ou `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (CI). Recursos e secrets: `ambientes.md`.

| Worker | staging | produção |
|---|---|---|
| API | `aprende-mais-api-staging` | `aprende-mais-api` |
| SPA | `aprende-mais-web-staging` | `aprende-mais-web` |
| Landing | `aprende-mais-staging` | `aprende-mais` |

## 1. Deploy
1. PR verde (CI: lint, typecheck, test, build, `check:wrangler`, smoke da landing).
2. Se há migration nova, aplique **antes** (§3) — o código novo não pode rodar sobre schema antigo.
3. GitHub → Actions → **Deploy** → *Run workflow* (ambiente + alvo `api|web|legada|todos`). Produção: tag `v*` (pede aprovação do Environment).
4. Verifique: `curl -i https://<worker>.<subdominio>.workers.dev/api/v1/avisos-privacidade/vigentes` (API, rota pública: espera 200) e a home da SPA/landing; olhe os logs (§5) por 5 min.
Sem CI (emergência): `pnpm install --frozen-lockfile && pnpm build && pnpm exec wrangler deploy --env staging`.

## 2. Rollback
Código (imediato, não mexe em dados):
```
pnpm exec wrangler versions list --env staging        # copie o id da versão anterior boa
pnpm exec wrangler rollback <version-id> --env staging -m "motivo"
```
Rollback não desfaz migration nem muda secrets/bindings da versão. Se a migration for incompatível com o código antigo, corrija para frente
(nova migration/deploy) ou restaure o banco (§3). Registre o motivo em `COMUNICACAO.md` e abra PEN se for defeito.

## 3. Aplicar migration (D1)
```
pnpm exec wrangler d1 export aprendemais-staging --remote --output backup-$(date +%F).sql   # backup (não versionar)
pnpm exec wrangler d1 migrations list  aprendemais-staging --env staging --remote
pnpm exec wrangler d1 migrations apply aprendemais-staging --env staging --remote
```
Landing: mesmo comando com o banco `APRENDEMAIS_LEADS_STAGING` na raiz. Ordem: staging → validar → produção (com backup). Migrations são só para frente.
Restaurar: `wrangler d1 time-travel restore aprendemais-staging --env staging --timestamp <RFC3339>` (últimos 30 dias; sobrescreve o banco — avise o time).

## 4. Rotacionar segredo
1. Gere: `openssl rand -hex 32` (Turnstile: painel → rotacionar *secret key*). Não cole o valor em chat, issue ou commit.
2. `pnpm exec wrangler secret put NOME --env staging` (prompt oculto). Cria e publica nova versão na hora; sem downtime.
3. Efeitos: `LEAD_SECRET` invalida `accessToken` em andamento; `APP_SECRET` invalida `apelidoToken` pendente (usuário refaz o passo);
   `IP_HASH_SECRET` quebra a comparação com hashes e contadores antigos (aceitável; contadores expiram); `ADMIN_TOKEN` desloga o painel.
4. Vazamento suspeito: rotacione primeiro, investigue depois; registre em `PENDENCIAS.md` (incidente LGPD → SEG/encarregado).
Listar nomes (nunca valores): `wrangler secret list --env staging`.

## 5. Logs
- Ao vivo: `pnpm exec wrangler tail --env staging --format pretty` (filtros: `--status error`, `--search texto`).
- Painel: Workers & Pages → Worker → *Logs*/*Metrics*; D1 → *Metrics*. `observability` ainda não está ligado nos `wrangler.toml` (RQ-30: sem PII).
- Os logs da API são JSON estruturado com `requestId` (header `X-Request-Id`); a retenção diária loga só contagens (`retencao_concluida`/`retencao_falhou`).
- Nunca cole conteúdo de log com e-mail/IP em canais abertos.

## 6. Contatos e limites
Quem aprova produção: Environment `production`. Plano Workers **Paid** é necessário (Argon2id ≈ 230 ms de CPU). R2 exige ativação na conta.
