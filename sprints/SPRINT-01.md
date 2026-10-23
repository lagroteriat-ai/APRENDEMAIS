# SPRINT 01 — v0.1 Fundação

**Objetivo:** deixar a base técnica, de segurança/LGPD, de dados e de design prontas, entregando o fluxo **cadastro → consentimento parental → login** com papéis (aluno, responsável, professor, gestor), e sanear a dívida da landing atual.
**Fora de escopo:** atividades, catálogo completo, painel do professor, ranking, gamificação.
**Pronto da sprint:** todas as tarefas ☑ · CI verde · E2E do fluxo de acesso verde · staging no ar · handoffs em `COMUNICACAO.md` · pendências da sprint resolvidas ou re-priorizadas.

## Como executar
1. Abra uma sessão por especialista (BE, FE, DEV, DAD, SEG, PED, UX, QA) e cole o **Prompt-base** de `ESPECIALISTAS.md`, indicando `SPRINT-01`.
2. Em cada sessão, cole o prompt da tarefa (abaixo) **quando a onda dela estiver liberada**.
3. Uma onda só inicia quando as tarefas de que depende estão ☑ (ou quando o **contrato** de que dependem consta em `COMUNICACAO.md` — nesse caso trabalhe com mock).
4. Dentro de uma onda, todas as sessões rodam **em paralelo**.
5. Modelo/esforço sugerido está na tabela; ajuste se necessário.

## Resumo das ondas
| Onda | Tarefas (paralelas entre si) | Libera |
|---|---|---|
| **0 — Decisões e contratos** | BE-00, BE-01, SEG-01, UX-01, QA-01, PED-01 | Onda 1 |
| **1 — Fundação** | DEV-01, BE-05, DAD-01, BE-02, FE-01, SEG-02 | Onda 2 |
| **2 — Implementação** | BE-03, BE-04, FE-02, DAD-02, SEG-03, PED-02, QA-02 | Onda 3 |
| **3 — Integração** | QA-03, SEG-04, UX-02, DEV-02 | Fechamento |

## Tarefas
| ID | Esp. | Tarefa | Onda | Depende de | Modelo/esforço | Status |
|---|---|---|---|---|---|---|
| S1-BE-00 | BE | Hotfix da landing (PEN-001/003/006) | 0 | — | Sonnet / médio | ☐ |
| S1-BE-01 | BE | ADR-001 arquitetura e convenções de API | 0 | — | Opus / alto | ☐ |
| S1-SEG-01 | SEG | Requisitos LGPD/menores | 0 | — | Opus / alto | ☐ |
| S1-UX-01 | UX | Fluxos e design tokens | 0 | — | Sonnet / médio | ☐ |
| S1-QA-01 | QA | Estratégia de testes | 0 | — | Sonnet / baixo | ☐ |
| S1-PED-01 | PED | Taxonomia BNCC/PE inicial | 0 | — | Sonnet / médio | ☐ |
| S1-DEV-01 | DEV | Monorepo, CI/CD, ambientes | 1 | BE-01 | Sonnet / médio | ☑ |
| S1-DAD-01 | DAD | Schema D1 base + migrations | 1 | BE-01, SEG-01 | Sonnet / alto | ☑ |
| S1-BE-02 | BE | Contrato OpenAPI de auth/consentimento | 1 | BE-01, SEG-01 | Sonnet / médio | ☐ |
| S1-FE-01 | FE | Design system base | 1 | UX-01, BE-01 | Sonnet / médio | ☑ |
| S1-SEG-02 | SEG | Threat model | 1 | BE-01, SEG-01 | Opus / alto | ☐ |
| S1-BE-03 | BE | Auth, sessões e papéis | 2 | DEV-01, DAD-01, BE-02 | Sonnet / alto | ☐ |
| S1-BE-04 | BE | API de consentimento parental | 2 | DEV-01, DAD-01, BE-02 | Sonnet / médio | ☐ |
| S1-BE-05 | BE | Migrar landing de Pages Functions para Worker + Static Assets (ADR-002) | 1 | BE-01 (coordena com DEV-01 em paralelo) | Sonnet / médio | ☐ |
| S1-FE-02 | FE | Telas login/cadastro/consentimento | 2 | FE-01, BE-02 (mock) | Sonnet / médio | ☑ |
| S1-DAD-02 | DAD | UNIQUE de leads + seed da taxonomia | 2 | DAD-01, PED-01 | Haiku-Sonnet / baixo | ☑ |
| S1-SEG-03 | SEG | Turnstile + rate limit na landing | 2 | DEV-01, BE-05 | Sonnet / médio | ☐ |
| S1-PED-02 | PED | Linguagem de consentimento/privacidade | 2 | SEG-01 | Sonnet / baixo | ☐ |
| S1-QA-02 | QA | Base de testes automatizados | 2 | QA-01, DEV-01 | Sonnet / médio | ☐ |
| S1-QA-03 | QA | E2E cadastro → consentimento → login | 3 | BE-03, BE-04, FE-02 | Sonnet / médio | ☐ |
| S1-SEG-04 | SEG | Revisão de segurança do auth | 3 | BE-03, BE-04, SEG-03 | Opus / alto | ☐ |
| S1-UX-02 | UX | Revisão UX/acessibilidade | 3 | FE-02 | Sonnet / baixo | ☐ |
| S1-DEV-02 | DEV | Staging e runbook | 3 | DEV-01, BE-03 | Sonnet / médio | ☐ |

**Caminho crítico:** BE-01 → DAD-01 → BE-03 → QA-03. Priorize essas tarefas.
**Estrutura provisória de pastas** (confirmada/ajustada em ADR-001): `apps/api`, `apps/web`, `packages/ui`, `packages/shared-types`, `db/`, `data/`, `docs/`, `tests/`. A landing e o `functions/` atuais ficam na raiz até a v1.0.

---

## Prompts por tarefa
> Formato: cole na sessão do especialista indicado, **depois do Prompt-base**. Cada prompt é autocontido.

### Onda 0

#### S1-BE-00 · Back-end · Hotfix da landing
```
Tarefa S1-BE-00 (Sprint 1, Onda 0). Corrija a landing legada, sem redesenhar nada:
1. PEN-001: o painel (admin.js linhas ~19 e ~57) chama /api/admin/leads, mas a função está em functions/admin/leads.js.
   Mova-a para functions/api/admin/leads.js (git mv) e confirme que admin.js não precisa mudar.
2. PEN-003: functions/api/prototype-access.js aceita qualquer leadId. Sem alterar schema: faça POST /api/leads devolver
   também um "accessToken" = HMAC-SHA256 do leadId com env.LEAD_SECRET, e exija esse token em prototype-access
   (comparação em tempo constante). script.js deve enviar o token (edição mínima; avise FE por AVISO em COMUNICACAO.md).
3. PEN-006: remova "detail: error.message" das respostas; compare ADMIN_TOKEN em tempo constante.
Arquivos: functions/**, script.js (mínimo). Não toque em schema/migrations (Dados) nem em estilos.
Critérios: painel lista/exclui leads; prototype-access rejeita token inválido; nenhuma resposta vaza mensagem interna.
Verifique com `npx wrangler pages dev .` se possível; senão descreva a validação manual.
Ao terminar: marque PEN-001/003/006 resolvidas (mover ao Arquivo), registre env nova (LEAD_SECRET) em COMUNICACAO.md → AVISO para DEV.
```

#### S1-BE-01 · Back-end · ADR-001
```
Tarefa S1-BE-01 (Sprint 1, Onda 0). Produza o ADR-001 em DECISOES.md (≤60 linhas) definindo:
- Stack final (proposta: Cloudflare Workers + D1 + R2 + KV; SPA React+Vite+TS; API em Workers com Hono ou similar;
  validação com Zod; monorepo com pnpm workspaces) — justifique cada escolha em 1 linha e liste alternativas descartadas.
- Estrutura de pastas (proposta no SPRINT-01.md) e fronteiras entre apps/packages.
- Convenções de API: versionamento (/api/v1), formato de erro {ok,error:{code,message}}, paginação, IDs (ULID/UUID),
  datas ISO-8601 UTC, i18n pt-BR, CORS, idempotência.
- Autenticação proposta (sessão em cookie HttpOnly + KV vs JWT) com prós/contras e escolha; papéis: aluno, responsavel, professor, gestor, admin.
- Estratégia para a landing legada coexistir até a v1.0.
Leia só: CLAUDE.md, functions/**, wrangler.toml. Não implemente código. Consulte regras LGPD só depois de SEG-01 se já existir
(não espere: registre premissas).
Ao terminar: publique "Convenções de API e stack (ADR-001)" como Contrato em COMUNICACAO.md e AVISO a todos (1 linha).
```

#### S1-SEG-01 · Segurança · Requisitos LGPD/menores
```
Tarefa S1-SEG-01 (Sprint 1, Onda 0). Crie docs/seguranca/lgpd-requisitos.md (≤120 linhas, tabela de requisitos com ID RQ-xx):
- Base legal e tratamento de dados de crianças/adolescentes (LGPD art. 14); faixa etária que exige consentimento parental
  (<18 como padrão conservador) e como verificar (e-mail do responsável com confirmação; sem exigir documentos).
- Minimização: dados mínimos por papel; o que NÃO coletar (CPF, endereço, localização).
- Direitos do titular (acesso, correção, exclusão, portabilidade) e prazos; retenção.
- Ranking: opt-in, pseudônimo/apelido, sem nome real nem foto; visibilidade por escola/município.
- Mídia (GIF/meme): regras de licenciamento e moderação.
- Logs e auditoria sem dados pessoais desnecessários; incidentes e notificação.
- Papéis e matriz de permissões inicial (aluno, responsável, professor, gestor, admin).
Leia só CLAUDE.md e functions/api/leads.js (para o tratamento atual). Não é aconselhamento jurídico: marque pontos que exigem
validação por jurista numa seção "Validar com jurídico".
Ao terminar: publique como Contrato em COMUNICACAO.md; crie PENDENCIAS para itens jurídicos.
```

#### S1-UX-01 · UX/UI · Fluxos e tokens
```
Tarefa S1-UX-01 (Sprint 1, Onda 0). Crie:
1. docs/ux/fluxos.md: fluxos (diagramas em texto/mermaid) de cadastro de aluno <18 com consentimento do responsável,
   login, recuperação de acesso, e visão inicial por papel (aluno e professor). Wireframes em ASCII para cada tela do Sprint 1.
2. docs/ux/tokens.json: cores (paleta derivada de style.css atual — leia só as variáveis :root), tipografia, espaçamento,
   raio, sombras, breakpoints; contraste mínimo AA documentado.
3. docs/ux/principios.md (≤40 linhas): tom de voz para Fund. I/II/Médio, acessibilidade (WCAG 2.2 AA), mobile-first,
   regras de gamificação saudável.
Não implemente código. Ao terminar: publique fluxos e tokens como Contratos em COMUNICACAO.md (FE depende deles).
```

#### S1-QA-01 · QA · Estratégia de testes
```
Tarefa S1-QA-01 (Sprint 1, Onda 0). Crie docs/qa/estrategia.md (≤80 linhas): pirâmide de testes proposta
(unit/integração/E2E), ferramentas sugeridas compatíveis com Cloudflare Workers + SPA (ex.: Vitest, Miniflare/workerd, Playwright,
axe-core), meta de cobertura por camada, dados de teste (sem dados pessoais reais), ambientes, quando cada suíte roda no CI,
critérios de aceite padrão, formato de relato de defeito. Leia só CLAUDE.md. Se o ADR-001 já existir, confirme as ferramentas com ele;
senão registre as premissas e ajuste depois (1 linha em PENDENCIAS).
```

#### S1-PED-01 · Pedagogia · Taxonomia BNCC/PE
```
Tarefa S1-PED-01 (Sprint 1, Onda 0). Crie data/curriculo/ com a taxonomia inicial:
- disciplinas.json (Português, Matemática, Ciências, História, Geografia, Inglês, Arte, Ed. Física… marcando as de prioridade),
  etapas e anos (EF1: 1º–5º; EF2: 6º–9º; EM: 1ª–3ª série).
- habilidades-<disciplina>.json no formato {codigo, descricao, ano, objeto_conhecimento, disciplina, fonte}.
  Escopo desta sprint: apenas Língua Portuguesa e Matemática do 5º ano EF (piloto), usando códigos BNCC oficiais (ex. EF05MA03).
- Referência ao currículo de Pernambuco: registre o link/fonte oficial e como mapear (campo pe_ref) — não invente códigos;
  se não tiver certeza de uma habilidade, marque "validar": true.
- data/curriculo/README.md: fontes oficiais, licença/uso, convenções, como validar.
Responda R1 (BACKLOG): licenciamento. Não escreva atividades ainda. Leia só CLAUDE.md.
Ao terminar: publique como Contrato em COMUNICACAO.md (DAD e BE consomem).
```

### Onda 1

#### S1-DEV-01 · DevOps · Monorepo, CI/CD, ambientes
```
Tarefa S1-DEV-01 (Sprint 1, Onda 1). Pré-requisito: ADR-001 em DECISOES.md. Leia: CLAUDE.md, ADR-001, wrangler.toml.
Entregue:
1. Estrutura monorepo conforme ADR-001 (pnpm workspaces ou o decidido) com apps/api, apps/web, packages/* vazios porém buildáveis.
2. .github/workflows: lint + typecheck + test + build em PR; deploy de preview (Workers: versão/Preview URL) por PR; deploy de produção (`wrangler deploy`) só em tag/manual. Hospedagem é só Workers (ADR-002): sem projeto Pages; crie também `dist-legacy/` (cópia só dos arquivos da landing) para o Worker legado (PEN-016).
3. wrangler.toml por ambiente (dev/staging/prod) com bindings DB/KV/R2 (IDs como placeholders documentados — PEN-002) e
   instruções para criar recursos; secrets listados (ADMIN_TOKEN, LEAD_SECRET, TURNSTILE_SECRET) sem valores.
4. docs/devops/ambientes.md (≤60 linhas) e unificação de README.md/README-CLOUDFLARE.md num README único (PEN-010).
Não escreva código de aplicação. A landing legada deve continuar publicável.
Critérios: CI verde num PR de exemplo; `pnpm i && pnpm build` funciona do zero.
Ao terminar: handoff + AVISO a todos com os comandos padrão (dev, test, build).
```

#### S1-DAD-01 · Dados · Schema D1 base
```
Tarefa S1-DAD-01 (Sprint 1, Onda 1). Leia: ADR-001, docs/seguranca/lgpd-requisitos.md, schema.sql e migrations/ (legado).
Crie db/migrations/ (numeradas NNNN_nome.sql, imutáveis) com: usuarios (id, papel, apelido, e-mail único, hash de credencial,
data_nascimento OU faixa_etaria, ativo, criado_em), responsaveis_vinculos, consentimentos (versão do texto, data, IP hasheado,
status, revogado_em), escolas, municipios, turmas, matriculas, sessoes (se a decisão do ADR usar D1), auditoria_acesso.
Mínimo de dados pessoais (RQ do SEG-01); chaves ULID/UUID; FKs; índices; UNIQUE onde cabe.
Também docs/dados/dicionario.md (tabela por campo: tipo, obrigatório, sensível?, retenção) e docs/dados/migrar.md (como aplicar local/remoto).
NÃO altere a tabela legada `leads` (será tratada em S1-DAD-02). Valide aplicando as migrations do zero em D1 local (`wrangler d1 migrations apply --local`).
Ao terminar: publique "Schema D1 base" como Contrato em COMUNICACAO.md.
```

#### S1-BE-02 · Back-end · Contrato OpenAPI de auth
```
Tarefa S1-BE-02 (Sprint 1, Onda 1). Leia: ADR-001, docs/seguranca/lgpd-requisitos.md. Escreva apps/api/openapi/auth.yaml (OpenAPI 3.1) para:
cadastro de aluno (com e-mail do responsável se <18), confirmação de e-mail, solicitação/concessão/revogação de consentimento pelo
responsável (link com token), login, logout, sessão atual (/me), recuperação de acesso, e cadastro de professor. Inclua modelos de erro
do ADR, códigos de erro, exemplos de payload e matriz de papéis. Gere também packages/shared-types com os tipos TS derivados (manual é aceitável).
Sem implementação. Ao terminar: publique como Contrato em COMUNICACAO.md; FE e QA começam com mock a partir dele.
```

#### S1-FE-01 · Front-end · Design system base
```
Tarefa S1-FE-01 (Sprint 1, Onda 1). Leia: ADR-001, docs/ux/tokens.json, docs/ux/principios.md, docs/ux/fluxos.md (só telas do Sprint 1).
Implemente apps/web (scaffold conforme ADR/DEV-01, se DEV-01 ainda não pronto crie só packages/ui e Storybook-like página de exemplo)
e packages/ui: tokens como CSS variables, componentes Button, Input, Select, Checkbox, FormField (rótulo/erro/ajuda), Card, Alert,
Modal, Layout responsivo mobile-first. Acessibilidade (foco visível, aria, contraste AA, teclado). Textos em pt-BR.
Teste unitário básico por componente. Não implemente telas de negócio (S1-FE-02). Ao terminar: handoff com como importar/usar os componentes.
```

#### S1-SEG-02 · Segurança · Threat model
```
Tarefa S1-SEG-02 (Sprint 1, Onda 1). Leia: ADR-001, docs/seguranca/lgpd-requisitos.md. Crie docs/seguranca/threat-model.md (≤120 linhas):
ativos (dados de menores, credenciais, sessões), fronteiras de confiança, ameaças STRIDE por componente (SPA, API, D1, KV, R2, admin),
abusos específicos (enumeração de usuários, força bruta, tokens de consentimento forjados, IDOR entre alunos/turmas, ranking fraudado),
mitigação e responsável (BE/DEV/FE/DAD), e requisitos de segurança verificáveis (SR-xx) que o QA possa testar. Registre achados que
exigirem decisão em PENDENCIAS.md. Não implemente.
```

### Onda 2

#### S1-BE-03 · Back-end · Auth, sessões e papéis
```
Tarefa S1-BE-03 (Sprint 1, Onda 2). Leia: ADR-001, apps/api/openapi/auth.yaml, docs/db/dicionario (docs/dados/dicionario.md),
threat-model (SR-xx relevantes). Implemente em apps/api: cadastro, confirmação, login, logout, /me, recuperação, papéis e middleware
de autorização por papel; hash de senha forte (Argon2/scrypt via WebCrypto compatível com Workers), cookies HttpOnly+Secure+SameSite,
rate limit de login, respostas que não enumerem usuários, auditoria sem dado pessoal desnecessário. Siga estritamente o OpenAPI;
mudança de contrato = AVISO ao FE/QA e nova versão. Testes unitários e de integração (Miniflare/workerd) por endpoint, incluindo casos negativos.
Não faça migrations (peça ao DAD via PEDIDO). Ao terminar: handoff com como rodar localmente e variáveis de ambiente.
```

#### S1-BE-04 · Back-end · Consentimento parental
```
Tarefa S1-BE-04 (Sprint 1, Onda 2). Leia: auth.yaml (seção consentimento), docs/seguranca/lgpd-requisitos.md, docs/dados/dicionario.md.
Implemente o fluxo de consentimento: aluno <18 fica "pendente" e sem acesso a recursos até o responsável confirmar via link com token
de uso único e expiração; registrar versão do texto aceito, data e IP hasheado; revogação; envio de e-mail via provedor abstraído
(interface + implementação fake para dev/teste; escolha do provedor real = PENDENCIA para DEV). Testes cobrindo expiração, reuso de
token, revogação e bloqueio de acesso sem consentimento. Ao terminar: handoff.
```

#### S1-BE-05 · Back-end · Migrar a landing para Worker
```
Tarefa S1-BE-05 (Sprint 1, Onda 1, em paralelo com DEV-01: combine pastas/nomes via COMUNICACAO.md). Leia: ADR-002 em DECISOES.md, wrangler.toml, functions/** (incl. _lib/seguranca.js), docs/devops/ambientes.md.
Migre a landing legada de Pages Functions para um Worker, sem mudar contratos HTTP (/api/leads, /api/prototype-access, /api/admin/leads):
1. Entrypoint `fetch(request, env, ctx)` (ex.: legacy/worker.js) que roteia por método+caminho e reaproveita a lógica atual e functions/_lib/seguranca.js
   (converta onRequestGet/Post/Delete e `context.env` → `env`). Respostas 404/405 em JSON.
2. Configuração do Worker (wrangler.toml do legado, coordenar com DEV-01): `main`, `[assets]` apontando SÓ para dist-legacy/
   (index.html, style.css, script.js, admin.*, assets/) — nunca para a raiz; binding D1 `DB`; segredos ADMIN_TOKEN, LEAD_SECRET.
3. Remova `pages_build_output_dir`. Mantenha `functions/` até validar; depois remova-a e atualize README-CLOUDFLARE.md (bindings e secrets via wrangler).
Valide com `wrangler dev`: cadastro, prototype-access com token, painel admin (listar/excluir). Teste que docs/ e apps/ NÃO são servidos.
Não altere schema (Dados) nem a lógica de Turnstile (SEG-03: avise para fazer sobre o Worker). Ao terminar: PEN-016 resolvida; AVISO a SEG/DEV/QA.
```

#### S1-FE-02 · Front-end · Telas de acesso
```
Tarefa S1-FE-02 (Sprint 1, Onda 2). Leia: docs/ux/fluxos.md, packages/ui (README), apps/api/openapi/auth.yaml.
Implemente em apps/web: cadastro (com ramo <18 → e-mail do responsável), tela de espera de consentimento, página de consentimento do
responsável (via token), login, recuperação de acesso e home vazia por papel. Consuma a API através de um cliente tipado
(packages/shared-types) com **mock via MSW** enquanto o backend não estiver pronto; alternar por variável de ambiente. Estados de
carregamento/erro, validação client-side espelhando o contrato, acessibilidade (WCAG AA). Testes de componente das telas principais.
Não crie regras de negócio no cliente. Ao terminar: handoff com como alternar mock/real.
```

#### S1-DAD-02 · Dados · UNIQUE de leads + seed da taxonomia
```
Tarefa S1-DAD-02 (Sprint 1, Onda 2). Leia: db/migrations/, data/curriculo/README.md, schema.sql.
1. PEN-005: nova migration que deduplica `leads` por e-mail (mantendo o registro mais antigo/mais completo) e adiciona UNIQUE em lower(email)
   (e telefone se fizer sentido, decida e justifique); documente o impacto no upsert e avise BE (AVISO) para ajustar functions/api/leads.js.
2. Seed da taxonomia: script/migration que carrega data/curriculo/ nas tabelas de catálogo mínimas (se o catálogo ainda não existir no
   schema, crie apenas disciplinas/anos/habilidades em migration separada).
Teste local do zero. Atualize docs/dados/dicionario.md. Não toque em apps/.
```

#### S1-SEG-03 · Segurança · Turnstile + rate limit na landing
```
Tarefa S1-SEG-03 (Sprint 1, Onda 2). PEN-004. Leia: functions/api/leads.js, index.html (form), script.js, docs/devops/ambientes.md.
Implemente Cloudflare Turnstile no formulário (widget em index.html + validação server-side em functions/api/leads.js usando
env.TURNSTILE_SECRET) e rate limit por IP (binding de Rate Limiting da Cloudflare ou KV com janela deslizante). Mensagens de erro
amigáveis em pt-BR. Escopo mínimo de edição em index.html/script.js (avise FE com AVISO). Não use chaves reais no repo. Teste os casos:
token ausente, inválido, excesso de requisições. Ao terminar: PEN-004 resolvida; documente as chaves a criar (AVISO a DEV).
```

#### S1-PED-02 · Pedagogia · Linguagem de consentimento e privacidade
```
Tarefa S1-PED-02 (Sprint 1, Onda 2). Leia: docs/seguranca/lgpd-requisitos.md, docs/ux/principios.md. Escreva em docs/pedagogia/textos-legais.md
(versão 1.0): (a) aviso de privacidade em linguagem simples para responsáveis; (b) versão "para estudantes" (EF1, EF2, EM — tom adequado
a cada faixa); (c) texto do termo de consentimento parental com versionamento (id "consent-v1"); (d) mensagens de e-mail do fluxo.
Marque o que precisa de revisão jurídica. Responda PEN-009. Sem código.
```

#### S1-QA-02 · QA · Base de testes automatizados
```
Tarefa S1-QA-02 (Sprint 1, Onda 2). Leia: docs/qa/estrategia.md, comandos de CI em docs/devops/ambientes.md.
Configure a infraestrutura de testes conforme a estratégia: Vitest para apps/api e packages, runner de componentes para apps/web, Playwright
(somente configuração + 1 teste "smoke" da landing), axe-core integrado, scripts `pnpm test`, `pnpm test:e2e`, relatório no CI.
Crie fixtures/factories de dados sintéticos (sem dados reais). Não escreva testes de features de outros (cada dono escreve os seus).
Critério: `pnpm test` roda e passa no CI. Handoff com convenções de nome e local dos testes.
```

### Onda 3

#### S1-QA-03 · QA · E2E do fluxo de acesso
```
Tarefa S1-QA-03 (Sprint 1, Onda 3). Leia: auth.yaml, docs/ux/fluxos.md, docs/seguranca/threat-model.md (SR-xx testáveis).
Escreva E2E (Playwright) contra preview/staging: aluno ≥18 (cadastro→login), aluno <18 (cadastro→bloqueado→consentimento→login),
revogação, expiração de token, enumeração de usuário, acesso por papel indevido. Inclua verificação axe nas telas. Defeitos →
PENDENCIAS com passos de reprodução. Relatório curto em docs/qa/relatorio-sprint-01.md (≤40 linhas).
```

#### S1-SEG-04 · Segurança · Revisão do auth
```
Tarefa S1-SEG-04 (Sprint 1, Onda 3). Revise (leitura) apps/api (auth, consentimento), functions/api/leads.js e headers de apps/web contra
docs/seguranca/threat-model.md e lgpd-requisitos.md: validação de entrada, sessão/cookies, CSRF, CORS, IDOR, enumeração, logs com dados pessoais,
segredos no repo (rg por chaves), headers de segurança (CSP, HSTS). Produza docs/seguranca/revisao-sprint-01.md com achados (severidade,
local, correção sugerida). Crítico/alto → BLOQUEIO em COMUNICACAO.md; demais → PENDENCIAS.md. Não corrija você mesmo.
```

#### S1-UX-02 · UX/UI · Revisão UX e acessibilidade
```
Tarefa S1-UX-02 (Sprint 1, Onda 3). Revise as telas de apps/web (S1-FE-02) contra docs/ux/fluxos.md, principios.md e WCAG 2.2 AA:
contraste, foco, rótulos, mensagens de erro, tamanho de alvo, linguagem. Produza docs/ux/revisao-sprint-01.md (checklist + achados) e
registre defeitos em PENDENCIAS.md (1 linha cada). Sem código.
```

#### S1-DEV-02 · DevOps · Staging e runbook
```
Tarefa S1-DEV-02 (Sprint 1, Onda 3). Leia: docs/devops/ambientes.md, handoff de BE-03. Publique o ambiente de staging (Workers + D1/KV de staging
com migrations aplicadas), configure secrets (sem expô-los), e escreva docs/devops/runbook.md (≤60 linhas): deploy, rollback, aplicar
migration, rotacionar segredo, onde ver logs. Valide o fluxo de acesso no staging e informe a URL ao usuário.
```

---

## Fechamento da sprint (coordenador/usuário)
- [ ] Todas as tarefas ☑ e CI verde.
- [ ] `COMUNICACAO.md` arquivado em `sprints/arquivo/COMUNICACAO-SPRINT-01.md` e zerado (manter Contratos vigentes).
- [ ] `PENDENCIAS.md` triado: resolvidas → Arquivo; abertas → backlog ou próxima sprint.
- [ ] `BACKLOG.md` atualizado (status ☑, ajustes de estimativa); decisões novas em `DECISOES.md`.
- [ ] Gerar `sprints/SPRINT-02.md` (v0.2) com ondas e prompts.
- [ ] **Encerrar todas as sessões de especialistas** e abrir novas na próxima sprint.
