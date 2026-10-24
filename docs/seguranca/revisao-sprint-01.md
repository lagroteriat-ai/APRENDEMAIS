# Revisão de segurança — Sprint 1 (S1-SEG-04)

> Dono: SEG · Data: 2026-10-23 · Base: `threat-model.md` (T01–T20, AB1–AB7, SR-01..SR-24) e `lgpd-requisitos.md` (RQ-01..RQ-36).
> **Documento interno**: não publicar como estático (SR-21 / PEN-026).

## 1. Escopo e método
Revisão **estática (leitura)**; nada foi corrigido e nenhum teste novo foi escrito. Os achados F-01 e F-03 vieram da leitura do fluxo; **a QA (S1-QA-03) os reproduziu em execução local** (F-01: 30 logins errados em paralelo → 30× 401 e nenhum 428; F-03: reenvio logo após o cadastro → 429 com e-mail novo × 202 com e-mail existente) e deixou testes prontos, hoje em `test.fail`, em `tests/e2e/acesso/08-isolados.isolado.spec.ts` (F-01) e `06-enumeracao-e-limites.spec.ts` (F-03). Ao corrigir, o Playwright avisa e o `test.fail` sai.

Lido: `apps/api/src/**` (app, sessão, acesso, rotas de cadastro/consentimento/sessões/recuperação/professores, limite, idempotência, retenção, auditoria, e-mail, senha), `packages/shared-types/src/{auth,comum}.ts`, `db/migrations`, `apps/web` (config, cliente, Desafio, Titulo, `wrangler.toml`, `dist/`), landing legada (`legacy/**`, `wrangler.toml`, `public/admin.js`), `.github/workflows/*`, `apps/api/test/seguranca.test.ts` (só os títulos).

**`functions/api/leads.js` não existe mais**: o código foi para `legacy/rotas/leads.js` (S1-BE-05). A revisão foi feita no novo caminho. `lgpd-requisitos.md` §1 e PEN-038 ainda citam o caminho antigo.

Busca por segredos (`rg` por chaves privadas, `sk_`, `AKIA`, JWT, `ghp_`, atribuições `secret/token/password = "..."`): **nenhum segredo real no repositório**. Só fixtures de teste e a chave pública de teste da Cloudflare (`1x0000000000000000000000000000000AA`, passa sempre) em `vitest.config.ts`, `scripts/e2e-acesso.mjs` e testes. `.dev.vars*` e `.env*` estão no `.gitignore` (só os `.example` existem). Não foi possível consultar o histórico do git (`git` fora do PATH nesta máquina).

## 2. Resumo
| Sev. | Qtde | Achados |
|---|---|---|
| Crítico | 0 | — |
| **Alto** | **1** | F-01 |
| Médio | 9 | F-02 … F-10 |
| Baixo | 6 | F-11 … F-16 |

**F-01 é BLOQUEIO** (COMUNICACAO §3). Nenhum dado real de aluno deve entrar em produção antes dele, e as pendências jurídicas PEN-011/PEN-047 já impedem isso hoje.

### O que está bem (verificado no código)
- **SQL**: todas as consultas usam `prepare().bind()`; as únicas interpolações são fragmentos fixos (`g.sql`, `${porEmail ? … : …}`) — SR-24 ok.
- **Mass assignment**: todo schema de corpo é `.strict()`; `papel`, `pontos` e `escolaId` nunca vêm do cliente — SR-03 ok.
- **Cookie**: `__Host-sid; Path=/; Secure; HttpOnly; SameSite=Lax`, sem `Domain`; token de 256 bits; o login apaga a sessão anterior — SR-05 ok.
- **Revogação**: `sessao_versao` é comparada no D1 a cada requisição; senha, revogação e exclusão incrementam — SR-06 ok.
- **Tokens de link**: 256 bits, só hash SHA-256 no banco, consumo atômico no `batch` com `guardaToken`, validade por tipo — SR-11 ok.
- **IDOR**: nenhuma rota recebe ID de objeto na URL; tudo é "sessão própria" ou "token de link". Sem superfície de BOLA no Sprint 1 (reavaliar quando houver turmas/ranking).
- **CORS**: não há cabeçalhos CORS; CSRF por `Origin` + `application/json` está coberto por teste para todas as operações — SR-04 ok.
- **Erros e logs**: erro 500 genérico, `registrarErro` sem corpo; auditoria só com IDs; chaves de rate limit e `ip_hash` são HMAC — RQ-30/32 ok no essencial.
- **Senha**: Argon2id com teto de parâmetros contra hash adulterado; hash "isca" para igualar o tempo do login.
- **Retenção**: pré-cadastro >7 d, anonimização de conta revogada, purga de links/chaves/auditoria (cron diário).
- **Bundle de produção**: `apps/web/dist/assets` atual não contém MSW nem o token de desafio simulado.

## 3. Achados

### F-01 · ALTO · Contagem de falhas de login acontece depois do hash (bypass de SR-09 por requisições paralelas)
- **Local**: `apps/api/src/rotas/sessoes.ts:38-53`.
- **Problema**: o fluxo é `consultar` (lê a contagem) → Turnstile se ≥3 → `verificarSenha` (≈230 ms de Argon2id) → `registrar` (incrementa) **só se falhou**. Consulta e incremento são duas chamadas separadas ao Durable Object, com o hash no meio. Se N requisições chegam juntas, todas leem `contagem = 0`, nenhuma é barrada, nenhuma exige Turnstile e todas gastam uma tentativa.
- **Cenário**: o atacante conhece (ou adivinha) um apelido (formato `AnimalAdjetivoNN`, ≈2,3 mi de combinações; AB1) e dispara 200 `POST /sessoes` simultâneos com senhas diferentes. Passam as 200, sem Turnstile e sem o 429 das 10 falhas. Depois do bloqueio de 15 min, repete. SR-09 ("3 falhas → Turnstile; 10 → 429") não vale sob concorrência; o mesmo vale para o limite por IP. As senhas de crianças são o elo fraco que o threat model aponta (AB2).
- **Correção sugerida**: incrementar **antes** de verificar, de forma atômica. Um método único no `Limitador` (`tentar(janelaSeg, agoraMs)`) incrementa e devolve a contagem já incluindo a tentativa. A decisão (Turnstile ≥3, 429 ≥10) usa esse valor; no sucesso chama `zerar`. Pode-se limitar também a concorrência por conta. Teste de QA: 30 logins errados em `Promise.all` contra a mesma conta devem terminar com ≤10 verificações de senha executadas e o restante em 428/429.

### F-02 · MÉDIO · SPA, landing e admin sem nenhum cabeçalho de segurança (SR-18, T01, T02)
- **Local**: `apps/web/wrangler.toml` (só `[assets]`, sem `main`), ausência de `apps/web/public/_headers`; mesma ausência em `public/` (landing e `admin.html`). Busca por `Content-Security-Policy|Strict-Transport|frame-ancestors|Referrer-Policy` no repositório só acerta o threat model. O Worker da API só define `X-Request-Id`, `Cache-Control: no-store` e `nosniff` (`app.ts:102-104`).
- **Impacto**: sem `frame-ancestors`, a tela de autorização do responsável e o login podem ser embutidos (clickjacking). Sem CSP, qualquer XSS futuro ou dependência comprometida (T03) age sem barreira. Sem `Referrer-Policy`, a origem vai para o Turnstile e terceiros. Sem HSTS, o primeiro acesso por `http://` não é protegido num domínio próprio (o `workers.dev` já vem na preload list). SR-18 é critério de aceite e hoje reprova.
- **Correção sugerida**:
  - SPA: `apps/web/public/_headers` (Static Assets aplica) com `Content-Security-Policy: default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, mais `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` fechada. Não há `style=` inline nem script inline no SPA, então `unsafe-inline` não é necessário (confirmar no `index.html` final do build). Isso fecha PEN-045.
  - API: `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` e HSTS no middleware de `app.ts`.
  - Landing/admin: o mesmo conjunto via `_headers` em `dist-legacy/` (ajustar a CSP aos scripts da landing e ao Turnstile) e incluir a checagem no `scripts/verificar-dist.mjs` e no `pnpm smoke:legado`.
  - QA: teste E2E que falha se faltar qualquer cabeçalho do SR-18 em staging.

### F-03 · MÉDIO · Cadastro de aluno ≥18: e-mail já existente é detectável pelo reenvio (derrota o DC-05 / AB1)
- **Local**: `apps/api/src/rotas/cadastro.ts:141-160` (isca) e `:218-230` (`reenviarPendencia`); estado em `servicos/tokens.ts:88-100`.
- **Problema**: para e-mail novo, o cadastro grava um `tokens_acao`; logo em seguida `reenviarPendencia` cai em `enviadosHoje > 0 && proximoEm > agora` e responde **429 RATE_LIMITED**. Para e-mail já cadastrado (sessão "isca"), `reenviarPendencia` responde sempre **202** (`if (!s.usuario) return ok(…, 202)`). Isso dá ao atacante um oráculo "este e-mail tem conta no Aprende+" com 2 requisições. A isca também pula os INSERTs, o que deve gerar diferença de tempo mensurável (SR-08 só exige o teste no login).
- **Mitigantes**: Turnstile no cadastro em staging/produção e 60 cadastros/h/IP. Mesmo assim, é uma varredura de e-mails de usuários adultos e anula uma decisão de projeto.
- **Correção sugerida**: a isca deve simular o mesmo estado de reenvio (guardar no registro KV da isca `enviados[]` e aplicar as mesmas regras de 5 min e 3/dia, com o mesmo `Retry-After`). Estender o teste de SR-08 ao cadastro e ao reenvio (status, corpo e mediana de tempo).

### F-04 · MÉDIO · Tokens de link na query string (`?t=`) chegam ao servidor, aos logs da Cloudflare e a `Referer`; o link de gestão dura 30 dias e é reutilizável
- **Local**: `apps/api/src/servicos/email.ts:11-22`; `apps/web/src/componentes/Titulo.tsx:29-38` (a SPA limpa a URL **depois** do primeiro render).
- **Problema**: a limpeza da URL no cliente não impede que a requisição `GET /responsavel/gerenciar?t=<token>` já tenha chegado ao Worker de assets, a logs, analytics e proxies com o token em claro (RQ-32: "sem PII em URLs/query strings"; T20). Para consentimento (7 d) e recuperação (30 min, uso único) o risco é limitado. O token `gerenciar_consentimento` vale 30 dias, **não é consumido** em consulta e permite revogar (e disparar anonimização) quantas vezes for usado.
- **Correção sugerida**: mover o token para o fragmento (`/responsavel/gerenciar#t=…`); o fragmento nunca é enviado ao servidor nem em `Referer`, e a SPA o lê de `location.hash` e o apaga com `history.replaceState`. Manter `Referrer-Policy: no-referrer` (F-02). Para o link de gestão, considerar trocar o token por uma sessão curta de responsável após a primeira abertura, ou reduzir a validade e renovar a cada uso.

### F-05 · MÉDIO · E-mail enviado a terceiros sem limite por destinatário (abuso de reenvio, AB7)
- **Local**: `apps/api/src/rotas/cadastro.ts:130` (E1/E3 no cadastro); só o aviso E6 tem teto por e-mail (`:156`). O teto de "≤3/dia" (`estadoReenvio`) é por **usuário**, e cada cadastro novo cria um usuário novo.
- **Problema**: qualquer pessoa pode cadastrar menores indefinidamente informando o e-mail da vítima como "responsável" e disparar E1 repetidos (até 60/h por IP, multiplicável por IPs). O conteúdo é do servidor (apelido sorteado), então o ganho é assédio e queda de reputação do domínio (SPF/DKIM/DMARC) em vez de phishing, mas é exatamente o abuso que AB7 quer evitar.
- **Correção sugerida**: contador por destinatário (`chaveOpaca(env, email)` no `Limitador`, p.ex. 5 e-mails de consentimento/confirmação por dia por endereço). Ao exceder, seguir respondendo "sucesso" sem enviar, para não virar oráculo. Aplicar também a `corrigirEmailPendencia`.

### F-06 · MÉDIO · Provedor de e-mail e `/dev/outbox` falham aberto: tudo que não for `production` usa a caixa de saída
- **Local**: `apps/api/src/email/provedor.ts:46-48`, `apps/api/src/app.ts:118-121`, `apps/api/wrangler.toml:15` (topo = `ENVIRONMENT = "dev"`, `workers_dev = true`).
- **Problema**: a escolha do provedor é `ENVIRONMENT === 'production' ? NaoConfigurado : Fake`. Um `wrangler deploy` sem `--env` (o COMUNICACAO do S1-BE-05 orienta Workers Builds com `npx wrangler deploy`) publica `aprende-mais-api-dev` em `workers.dev` com `ENVIRONMENT=dev`, e `GET /api/v1/dev/outbox` (sem autenticação) lista **todos os links com token** (consentimento, confirmação, recuperação) → tomada de qualquer conta e consentimento forjado naquela implantação. Um erro de digitação no valor de produção produz o mesmo efeito.
- **Correção sugerida**: inverter a lógica (Fake só se `ENVIRONMENT` for explicitamente `dev` ou `test`; qualquer outro valor → `NaoConfigurado`); proteger `/dev/outbox` também por origem local (recusar se `CF-Connecting-IP` não for de loopback) ou por secret; no topo do `wrangler.toml` usar `workers_dev = false`; fazer o `check:wrangler` falhar se alguém tentar o deploy sem `--env`.

### F-07 · MÉDIO · Trilha de auditoria incompleta para alteração de consentimento e do e-mail do responsável (RQ-31, SR-17, T08)
- **Local**: `apps/api/src/rotas/consentimento.ts:175-185` (`definirRankingConsentimento` revoga o consentimento de ranking sem `comandoAuditoria`); `apps/api/src/rotas/cadastro.ts:239-276` (`corrigirEmailPendencia` troca o e-mail do responsável do menor sem auditoria; também não há aviso ao e-mail antigo). `escolherPapel` também não deixa rastro.
- **Impacto**: RQ-31 manda auditar "alteração de consentimento"; hoje a revogação de ranking e a troca do destinatário do consentimento não aparecem.
- **Correção sugerida**: incluir as ações `consentimento.ranking_revogar` e `conta.email_responsavel_corrigir` (e, se for o caso, `sessao.papel_escolher`) no `AcaoAuditoria`, dentro do mesmo `batch` da alteração; avisar o e-mail antigo quando o do responsável mudar; atualizar o dicionário (PEN-050).

### F-08 · MÉDIO · CI sem `pnpm audit` e sem detecção de segredos (SR-23, T03, T11)
- **Local**: `.github/workflows/ci.yml` (lint, typecheck, test, build, `check:wrangler`, smoke, e2e; nada de auditoria de dependências nem de varredura de segredos); busca por `audit|gitleaks|trufflehog` em `.github` não encontra nada.
- **Correção sugerida**: passo `pnpm audit --audit-level=high` (falha em alto/crítico) e um scanner de segredos no diff (gitleaks ou equivalente) como job obrigatório; habilitar Dependabot/secret scanning e push protection no GitHub. Lembrar que o CI ainda nunca rodou no GitHub (PEN-010).

### F-09 · MÉDIO · Landing legada: upsert por `email OR telefone` ainda sobrescreve lead alheio e devolve o `accessToken` dele; entradas sem limite de tamanho
- **Local**: `legacy/rotas/leads.js:57-79`. Rastreado como PEN-005/PEN-038 (P1); a troca para `ON CONFLICT (lower(email))` **ainda não foi aplicada** no código.
- **Problema**: quem informa o e-mail ou o telefone de outra pessoa reescreve nome, sobrenome, telefone e perfil do lead existente, e recebe `leadId` + `accessToken` desse lead. O público inclui menores e não há consentimento parental (PEN-009/PEN-014). Complementos novos desta revisão: `nome`, `sobrenome`, `telefone` e `perfil` não têm teto de tamanho nem validação de formato; `request.json()` não confere `Content-Type`, então um `POST` cross-site `text/plain` (sem preflight) é processado. O Turnstile e o rate limit mitigam abuso em massa, mas não a sobrescrita dirigida.
- **Correção sugerida**: aplicar PEN-038 (depois da migration 0002 — PEN-040); não devolver o `accessToken` de lead que já existia sem prova de posse (por exemplo, devolver sempre um token do registro recém-criado/atualizado pelo próprio fluxo e não permitir reescrita de campos já preenchidos); limites de tamanho (nome ≤120, telefone ≤20, perfil em lista fechada); exigir `Content-Type: application/json` e `Origin` próprio. Seguir a recomendação do PED de não captar menores no formulário atual.

### F-10 · MÉDIO · Painel admin legado: token estático sem proteção contra força bruta e sem trilha (T17, T18, RQ-31, RQ-34)
- **Local**: `legacy/lib/seguranca.js:29-34`, `legacy/rotas/admin-leads.js`, `wrangler.toml` (o rate limit `RATE_LIMITER` cobre só `POST /api/leads`), `public/admin.js:9,74` (token em `sessionStorage`).
- **Problema**: `GET/DELETE /api/admin/leads` aceita tentativas ilimitadas de `Bearer`; não há requisito de entropia do `ADMIN_TOKEN`; a página `admin.html` é pública no mesmo host. A listagem devolve PII (nome, e-mail, telefone) até 1000 linhas sem registro de acesso nem motivo. O token em `sessionStorage` fica exposto a qualquer XSS (sem CSP — F-02).
- **Correção sugerida**: aplicar rate limit por IP também em `/api/admin/*` (3–5 falhas/min); documentar e exigir `ADMIN_TOKEN` com ≥32 bytes aleatórios; rotacionar o valor atual (T18) e nunca reutilizá-lo na plataforma nova; proteger `/admin*` com Cloudflare Access; registrar (sem PII) cada listagem/exclusão; tratar PEN-007/PEN-008 (LIKE e CSV) junto.

### F-11 · BAIXO · `consentimentos.ip_hash` é guardado por tempo indeterminado (RQ-30: ≤90 dias)
- **Local**: `apps/api/src/rotas/consentimento.ts:76-85`; `apps/api/src/retencao.ts:64` (só zera na anonimização da conta).
- **Correção sugerida**: no cron, `UPDATE consentimentos SET ip_hash = NULL WHERE decidido_em < agora − 90 d`. Rotacionar `IP_HASH_SECRET` com cuidado: invalida os contadores de rate limit em curso.

### F-12 · BAIXO · Repetição de uma `Idempotency-Key` emite novo cookie de sessão, sem vínculo com quem chama
- **Local**: `apps/api/src/idempotencia.ts:77-79`; `cadastro.ts:162-180` e `professores.ts:111-120` (`reconstruir*` chamam `emitirSessao`).
- **Problema**: quem repetir a mesma chave **e o mesmo corpo** (que contém a senha) recebe uma sessão nova da conta, inclusive depois de um logout. A exploração exige conhecer corpo e chave, então o risco prático é baixo, mas a sessão deveria nascer do login, não do replay.
- **Correção sugerida**: no replay devolver o resultado sem `Set-Cookie` (a SPA já tem a sessão do 1º pedido) ou vincular a chave ao `ipHash`/cookie do pedido original.

### F-13 · BAIXO · Negação de acesso dirigida a contas de crianças
- **Local**: `sessoes.ts:42` (10 falhas bloqueiam a conta por 15 min); `recuperacao.ts:48-52` (cada pedido invalida o link anterior e 3/dia esgotam a recuperação).
- **Problema**: quem souber um apelido pode bloquear o login (precisa resolver o Turnstile nas falhas 4–10) e, pela recuperação, invalidar o link que o responsável acabou de receber e consumir a cota diária de 3 e-mails. Efeito: aluno sem acesso e responsável sem recuperação por até 24 h.
- **Correção sugerida**: na recuperação, não invalidar o link ainda válido ao reemitir dentro de uma janela curta (reenviar o mesmo) e exigir Turnstile a partir do 2º pedido por conta; manter o bloqueio de login, mas com aviso ao responsável quando houver bloqueios repetidos.

### F-14 · BAIXO · Corpo sem limite de tamanho antes do parse
- **Local**: `apps/api/src/app.ts:70-85` (`c.req.text()` lê tudo antes da validação; o rate limit dos handlers vem depois do parse).
- **Correção sugerida**: `bodyLimit` do Hono (p.ex. 16 KB) antes de `lerCorpo`.
- **Retificação (2026-10-23, após S1-QA-03)**: a versão anterior também sugeria exigir `Content-Type` JSON quando o corpo vem vazio. **Retirado.** O QA mostrou (PEN-067) que, no `wrangler dev`, o `body` de `DELETE /sessoes/atual` e `POST /cadastro/pendencia/reenvio` chega não nulo e vazio, e o `app.ts:63` já devolve 403. A sugestão agravaria o defeito. A correção certa (PEN-067) não enfraquece o CSRF: tratar 0 bytes como "sem corpo" só dispensa o `Content-Type`; a checagem de `Origin` continua valendo para todo método que altera estado, e um corpo vazio não carrega dado para o handler.

### F-15 · BAIXO · Revogação por link de gestão é um clique irreversível para quem tiver o link
- **Local**: `apps/api/src/rotas/consentimento.ts:187-219`.
- **Problema**: um link encaminhado (T20) permite revogar, o que suspende a conta e dispara a anonimização no próximo cron (a mensagem promete "até 15 dias", o job apaga no ciclo seguinte). Perda de dados do menor sem confirmação adicional. RQ-07 pede revogação fácil; este é o contraponto.
- **Correção sugerida**: período de carência real (anonimizar só ao fim de `VALIDADE.exclusao`, cancelável pelo mesmo link) ou passo de confirmação por e-mail; auditoria já existe.

### F-16 · BAIXO · Artefatos de mock no pacote publicado da SPA
- **Local**: `apps/web/public/mockServiceWorker.js` é copiado para `dist/` em todo build; o resto do mock fica fora do bundle quando `VITE_API_MOCK=false` (confirmado no `dist` atual).
- **Risco**: se um deploy sair com `VITE_API_MOCK=true`, o login passa a ser simulado no navegador.
- **Correção sugerida**: remover o service worker do build de produção e fazer o build falhar (ou o `verificar-dist.mjs`) se o bundle contiver `mock-turnstile-token`.

## 4. Observações (sem severidade)
- **Idade autodeclarada**: quem informa ≥18 anos recebe conta própria, sem consentimento parental; é a premissa de RQ-02/RQ-04 (pendente de jurídico, PEN-011), não um defeito de código. Da mesma forma, o menor pode informar um e-mail seu como "responsável" (risco residual aceito em RQ-04; SR-12 não é verificável, ver mensagem de BE de 2026-10-23).
- **Admin**: não há rota de dados de admin no Sprint 1; PEN-025 (2º fator) precisa estar resolvido antes da primeira (SR-22).
- **Turnstile**: `1x0000000000000000000000000000000AA` nunca pode ser configurado como `TURNSTILE_SECRET` em staging/produção (aprova qualquer token).
- **Logs**: `registrarErro` remove só e-mails da mensagem; preferir lista fechada (nome do erro + código SQLite) em vez de mensagem livre.
- **Limites por IP em escola**: o NAT escolar faz o Turnstile aparecer para todos depois de 3 falhas; é UX, não segurança (ADR-004).
- **Doc desatualizado**: `lgpd-requisitos.md` §1 e PEN-038 citam `functions/api/leads.js`.
- **PEN-067 (QA) visto por SEG**: "Sair" que responde ok e deixa a sessão viva no servidor viola SR-06 e T02 (computador compartilhado na escola). Hoje só foi reproduzido localmente; **se reproduzir em staging, a severidade é Alta** e vira BLOQUEIO, junto com F-01.
- **Não coberto**: R2 (sem uso ainda), ranking, atividades, papéis de professor/gestor com vínculo (RQ-36) e o contrato OpenAPI × implementação além do que `contrato.test.ts` já verifica.
