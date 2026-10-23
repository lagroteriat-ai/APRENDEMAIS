# DECISOES — log de decisões (ADRs)

Registre decisões duráveis aqui (curtas). Uma decisão não é reaberta sem novo ADR que a substitua.

## Template
```
## ADR-NNN — Título
- Data: AAAA-MM-DD · Autor: <esp.> · Status: proposta | aceita | substituída por ADR-XXX
- Contexto: (2–3 linhas)
- Decisão: (o que ficou decidido)
- Consequências: (o que muda; impactos em outros especialistas)
```

## Decisões vigentes
- **Pré-ADR (2026-10-22, usuário):** stack Cloudflare completa (Pages/Workers, D1, R2, KV); LGPD/menores é requisito desde a v0.1; landing de leads atual permanece até a v1.0.

## ADR-001 — Stack, estrutura e convenções de API
- Data: 2026-10-22 · Autor: BE · Status: aceita (hospedagem em Pages substituída por ADR-002; o restante vale)
- Contexto: a plataforma nova (alunos, professores, rankings; inclui menores) substitui o protótipo; stack Cloudflare já decidida (pré-ADR). Premissas: `docs/seguranca/lgpd-requisitos.md` v1.0 (RQ-nn) vale; itens ⚖ seguem sem validação jurídica; dados ficam em Cloudflare, possivelmente fora do Brasil (PEN-017).

### 1. Stack — escolha (motivo) · descartados
- **Web:** SPA React + Vite + TypeScript em Cloudflare Pages (conteúdo autenticado, sem SEO; build estático barato). ✗ Next/Remix (adaptador CF e SSR sem ganho), Vue/Svelte (menos ecossistema).
- **API:** Workers + Hono (roteador leve, nativo de Workers, middlewares tipados). ✗ Pages Functions (acopla API ao deploy do front), Express/Node (fora do runtime).
- **Validação:** Zod em toda fronteira; schemas em `packages/shared-types` = fonte única de tipos web/api. ✗ validação manual (padrão do legado).
- **Dados:** D1 com SQL puro `prepare().bind()` e migrations em `db/migrations`. ✗ ORM (peso/suporte D1; reavaliar), Postgres externo (fora da decisão Cloudflare).
- **R2:** mídia curada (RQ-26/27) e exportações temporárias; bucket privado servido pelo Worker com autorização. Alunos não fazem upload.
- **KV:** sessões e cache de leitura de currículo. Nunca contadores/idempotência (consistência eventual). Rate limit: binding de Rate Limiting/WAF + Turnstile nos formulários públicos.
- **Monorepo:** pnpm workspaces (rápido, estrito). ✗ npm/yarn, Nx/Turborepo (excesso agora). Qualidade: TS `strict`, ESLint, Vitest (api/packages), Playwright (E2E).
- **Ambientes:** local (`wrangler dev` + Vite), staging, prod; D1/KV/R2 separados por ambiente; segredos só via `wrangler secret`, nunca no repo.

### 2. Estrutura e fronteiras
- `apps/api` (Worker) · `apps/web` (SPA) · `packages/ui` (React + tokens CSS) · `packages/shared-types` (Zod, tipos, códigos de erro) · `db/` · `data/` · `docs/` · `tests/`. Escopo `@aprendemais/*`. Landing legada fica na raiz.
- Dependências permitidas: web → ui, shared-types · api → shared-types · ui → nada interno · shared-types → só zod. Proibido web↔api direto.
- D1/KV/R2 só são tocados em `apps/api`, em camadas routes → services → repos; autorização num único módulo `policy` (nega por padrão, RQ-35).

### 3. Convenções de API
- **Versão:** `/api/v1`; só mudanças aditivas dentro da versão; quebra = `/v2` com `Deprecation`/`Sunset` na antiga.
- **Resposta:** sucesso `{ ok:true, data, meta? }`; erro `{ ok:false, error:{ code, message, details? } }`. `code` estável em MAIÚSCULAS_SNAKE; `message` pt-BR sem detalhe interno (RQ-32); `details` = erros de campo `[{path, code}]`. `X-Request-Id` em toda resposta.
- **Status:** 400 `VALIDATION_ERROR` · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 404 `NOT_FOUND` (também para recurso fora do vínculo, evita enumeração) · 409 `CONFLICT` · 429 `RATE_LIMITED` · 500 `INTERNAL`.
- **Paginação:** cursor opaco — `?limit` (padrão 25, máx 100) e `?cursor`; resposta `meta:{ nextCursor }`; ordem estável por ULID; sem total por padrão.
- **IDs:** ULID em texto, gerado na API; nunca inteiro sequencial exposto (lição de PEN-003). JSON em camelCase; colunas SQL em snake_case (mapeado nos repos).
- **Datas:** ISO-8601 UTC com `Z` (`2026-10-22T14:03:00.000Z`), TEXT no D1; nascimento só `AAAA-MM` (RQ-02). A UI formata em `America/Recife`.
- **i18n:** `message` e textos de UI em pt-BR; códigos independentes de idioma; UI com catálogo de strings (só `pt-BR` agora).
- **CORS/CSRF:** alvo = mesmo host (`/api/v1/*` roteado ao Worker, resto ao Pages) → sem CORS em prod; a confirmar em DEV-01, fallback subdomínio `api.` com allowlist exata `ALLOWED_ORIGINS` + credenciais (nunca `*`). Métodos que alteram estado exigem `Content-Type: application/json` e `Origin` na allowlist.
- **Idempotência:** `Idempotency-Key` (UUID) em POSTs que criam/consomem (cadastro, consentimento, resposta de atividade); chave + hash do corpo em tabela D1 com UNIQUE, TTL 24 h; mesma chave com corpo diferente → 409 `IDEMPOTENCY_CONFLICT`. PUT/DELETE são idempotentes por desenho.
- **Logs:** estruturados, sem PII, com `requestId` e ID opaco (RQ-30); auditoria conforme RQ-31.

### 4. Autenticação e papéis
- **A — Sessão opaca em cookie + KV (escolhida).** Prós: revogação/logout simples, nada sensível no cliente, papel nunca "velho" no token. Contras: leitura em KV por requisição; KV é eventualmente consistente (revogação pode levar ~60 s).
- **B — JWT.** Prós: sem estado, sem leitura. Contras: revogação difícil, claims desatualizadas após mudar papel/consentimento, exposição se vazar. Descartado: incompatível com revogar consentimento/exclusão (RQ-07/14) em dados de menores.
- **Detalhes:** token aleatório de 256 bits; cookie `__Host-sid` (Secure, HttpOnly, SameSite=Lax, Path=/); KV guarda só o hash SHA-256 do token → `{userId, expiresAt}`. TTL (premissa, SEG-02 ajusta): aluno/responsável 7 d ocioso/30 d absoluto; professor/gestor 12 h/7 d; admin 8 h absoluto.
- **Efeito imediato:** status do usuário (ativo, consentimento, exclusão) e papéis/vínculos são lidos do D1 a cada requisição autenticada; o KV só prova identidade. Troca de papel/senha invalida as sessões do usuário.
- **Senhas:** PBKDF2-SHA256 (WebCrypto, ≥600 mil iterações; revisar p/ Argon2id-WASM se o CPU do Worker exigir). Aluno pode não ter e-mail: credencial = usuário + senha (ou PIN de turma) — definir em BE-02/UX.
- **Papéis:** `aluno`, `responsavel`, `professor`, `gestor`, `admin` (RQ §8). Um usuário pode ter mais de um; papel não vai no cookie. RBAC + vínculo (turma/escola/aluno-responsável) checado no servidor. `admin` só por seed/CLI, nunca auto-cadastro; `professor`/`gestor` por convite; ações de admin auditadas com motivo (RQ-34).

### 5. Coexistência com a landing legada (até a v1.0)
- Legada continua no projeto Pages atual (raiz, `functions/`, D1 `APRENDEMAIS_LEADS`, segredos `ADMIN_TOKEN`/`LEAD_SECRET`), congelada: só correções de segurança/LGPD.
- Nova plataforma em projeto Pages + Worker separados, host de staging (`beta.`), com D1/KV/R2 e segredos próprios — nada compartilhado com a landing. Rotas não colidem (`/api/v1/*` × `/api/leads`).
- **Risco:** `wrangler.toml` tem `pages_build_output_dir = "."`; se o deploy usa isso, toda a árvore (`docs/`, `apps/`, planejamento) vira estático público. DEV-01 deve publicar só a landing (build que copia seus arquivos para `dist-legacy/`, sem mover nada) antes de entrar código/threat model em `main` (PEN-016).
- Cutover na v1.0: apontar o domínio principal à nova plataforma, tratar leads antigos (PEN-014), aposentar o legado.

> Onde ADR-001 diz "Pages", "Pages Functions" ou `pages_build_output_dir`, leia **Workers + Static Assets** (ADR-002).

### Consequências
- BE-02 detalha auth em OpenAPI nestas convenções; DAD cria `idempotency_keys` e `usuarios/papéis/vínculos`; DEV-01 monta o monorepo, o roteamento `/api/v1/*` e o isolamento do deploy legado; SEG-02 revisa TTLs, PBKDF2 e CSRF; FE usa `shared-types` e o formato de erro; QA testa contra o OpenAPI.


## ADR-002 — Hospedagem 100% em Cloudflare Workers (sem Pages)
- Data: 2026-10-22 · Autor: coordenação (decisão do usuário) · Status: aceita · Substitui a parte de hospedagem do ADR-001
- Contexto: o projeto roda em Cloudflare **Workers**. A landing atual foi escrita como Pages Functions (`functions/`, `onRequest*`, `pages_build_output_dir`).
- Decisão:
  - **Web (SPA):** Worker com **Static Assets** (`[assets]` no `wrangler.jsonc`/`wrangler.toml`, `not_found_handling = "single-page-application"`); build Vite em `apps/web/dist`. Sem projeto Pages.
  - **API:** Worker Hono em `apps/api` (inalterado). Mesmo host: `/api/v1/*` roteado ao Worker da API (route/Service Binding); estáticos servidos pelo Worker do web. Sem CORS em prod.
  - **Landing legada:** migra de Pages Functions para **um Worker** (entrypoint `fetch` roteando `/api/leads`, `/api/prototype-access`, `/api/admin/leads`; estáticos via `[assets]` apontando só para os arquivos da landing em `dist-legacy/`). Mantém D1 `APRENDEMAIS_LEADS`, `ADMIN_TOKEN`, `LEAD_SECRET`. Resolve PEN-016 (a raiz deixa de ser publicada).
  - **Ambientes:** `[env.staging]`/`[env.production]` por Worker; segredos via `wrangler secret`; deploy por GitHub Actions (`wrangler deploy`) ou Workers Builds. Previews por PR via versões/Preview URLs do Worker.
  - Handlers `onRequestGet/Post/Delete` e `context.env` viram `fetch(request, env, ctx)`; a lógica e `functions/_lib/seguranca.js` são reaproveitadas.
- Consequências: DEV-01 monta Workers (não Pages) e o `dist-legacy/`; nova tarefa S1-BE-05 migra a landing; README-CLOUDFLARE e CI usam `wrangler deploy`; `Workers & Pages` no painel segue válido, mas os bindings ficam no `wrangler`.

## ADR-003 — Ferramental do monorepo e stack de testes
- Data: 2026-10-22 · Autor: DEV · Status: aceita · Complementa ADR-001/002 · Fecha PEN-018
- Contexto: DEV-01 montou o monorepo; o QA propôs ferramentas de teste fora do ADR-001 (`docs/qa/estrategia.md`).
- Decisão:
  - **Versões num só lugar:** `catalog:` em `pnpm-workspace.yaml`; pacotes não declaram versão própria. TypeScript fica em 6.x (typescript-eslint ainda não suporta 7) e Vitest em 4.1.x (exigido por `@cloudflare/vitest-pool-workers`); subir juntos quando o pool suportar.
  - **Pacotes internos** (`packages/*`) são consumidos como código-fonte (`exports` → `src/`), sem build próprio; `build` deles = typecheck (ou vite no `ui`, se precisar).
  - **Testes ratificados:** unitário/integração do Worker com Vitest + `@cloudflare/vitest-pool-workers`; componentes com Testing Library + jsdom + axe; E2E com Playwright. Instalar cada ferramenta junto do primeiro teste que a usa. Regressão visual: adiada (nightly, S2+).
  - **Deploy:** `wrangler.toml` com `[env.staging]`/`[env.production]` (topo = dev); preview por PR = `wrangler versions upload --env staging --preview-alias pr-N`; produção só por tag `v*`/manual. Detalhes em `docs/devops/ambientes.md`.
- Consequências: `pnpm build` roda o build de todo pacote (um `build` quebrado derruba o CI); QA/BE seguem `catalog:` ao adicionar dependências.
