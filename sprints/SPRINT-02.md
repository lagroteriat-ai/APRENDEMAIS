# SPRINT 02 — v0.2 Núcleo do aluno

**Objetivo:** o aluno entra, escolhe uma disciplina-piloto (Português e Matemática, 5º ano EF), faz atividades de **flashcards** e **preenchimento de lacunas** com feedback imediato, e ganha XP e progresso. Fecha também a dívida de segurança P1 herdada da Sprint 1.
**Fora de escopo:** painel do professor, cruzadinhas, mapas mentais, mídia (GIF/meme), streaks, ranking.
**Pronto da sprint:** tarefas ☑ · CI verde · E2E "login → escolher trilha → concluir atividade → ver XP" verde · 100 atividades-piloto revisadas e carregadas · staging no ar · handoffs em `COMUNICACAO.md` · pendências triadas.

## Pré-requisitos (ações humanas, fora das sessões)
Sem isto a sprint roda só local/mocks. Detalhes em `docs/devops/ambientes.md` §4 e §8.
- [ ] PEN-002: criar D1/KV/R2 e preencher os `COLOQUE_*` dos `wrangler.toml`.
- [ ] PEN-034/033: GitHub (branch protection do CI) e domínio no mesmo host.
- [ ] PEN-047: escolher provedor de e-mail transacional (sem ele não há cadastro de menor em produção).
- [ ] PEN-048: aprovar o ADR-004 e confirmar plano Workers Paid.
- [ ] PEN-019: conferir a taxonomia contra o PDF oficial da BNCC (necessário antes de **publicar** atividades; não bloqueia o desenvolvimento).
- [ ] PEN-011: parecer jurídico (necessário antes de dados reais de alunos).

## Como executar
Igual à Sprint 1: uma sessão por especialista, prompt-base de `ESPECIALISTAS.md` (indicar `SPRINT-02`), depois o prompt da tarefa quando a onda estiver liberada; dentro da onda, tudo em paralelo; dependência de **contrato** basta o contrato constar em `COMUNICACAO.md` (trabalhe com mock).

## Resumo das ondas
| Onda | Tarefas (paralelas entre si) | Libera |
|---|---|---|
| **0 — Contratos e dívida** | BE-00, BE-01, DAD-01, UX-01, SEG-01, QA-01, DEV-01 | Onda 1 |
| **1 — Fundação do núcleo** | DAD-02, BE-02, FE-01, PED-01 | Onda 2 |
| **2 — Funcionalidades** | BE-03, FE-02, FE-03, PED-02 | Onda 3 |
| **3 — Integração** | FE-04, QA-02, SEG-02, UX-02, DEV-02 | Fechamento |

## Tarefas
| ID | Esp. | Tarefa | Onda | Depende de | Modelo/esforço | Status |
|---|---|---|---|---|---|---|
| S2-BE-00 | BE | Dívida de segurança P1 (PEN-056, 059, 038) | 0 | — | Sonnet / alto | ☐ |
| S2-BE-01 | BE | Contrato OpenAPI de catálogo/atividades/tentativas + schemas Zod de conteúdo | 0 | — | Opus / alto | ☐ |
| S2-DAD-01 | DAD | Modelo de atividades, tentativas e progresso (contrato) | 0 | — | Sonnet / alto | ☐ |
| S2-UX-01 | UX | Fluxo e wireframes do player e da home do aluno | 0 | — | Sonnet / médio | ☐ |
| S2-SEG-01 | SEG | Requisitos de segurança do núcleo (anti-trapaça, XP, conteúdo) | 0 | — | Opus / médio | ☐ |
| S2-QA-01 | QA | Plano de testes do motor e do player | 0 | — | Sonnet / baixo | ☐ |
| S2-DEV-01 | DEV | Staging real: recursos, provedor de e-mail, CI de seeds | 0 | pré-requisitos humanos | Sonnet / médio | ☐ |
| S2-DAD-02 | DAD | Migrations 0007+ e seed do catálogo; dicionário | 1 | DAD-01, BE-01 | Sonnet / médio | ☐ |
| S2-BE-02 | BE | API de catálogo e atividades (leitura) | 1 | BE-01, DAD-01 | Sonnet / alto | ☐ |
| S2-FE-01 | FE | Base do player (shell, progresso, feedback) | 1 | UX-01, BE-01 (mock) | Sonnet / médio | ☐ |
| S2-PED-01 | PED | Catálogo piloto completo + 30 atividades-modelo | 1 | BE-01 | Sonnet / alto | ☐ |
| S2-BE-03 | BE | Motor de correção, tentativas, progresso e XP | 2 | BE-02, DAD-02, SEG-01 | Sonnet / alto | ☐ |
| S2-FE-02 | FE | Player de flashcards | 2 | FE-01, BE-01 (mock) | Sonnet / médio | ☐ |
| S2-FE-03 | FE | Player de lacunas | 2 | FE-01, BE-01 (mock) | Sonnet / médio | ☐ |
| S2-PED-02 | PED | Completar 100 atividades revisadas | 2 | PED-01, BE-02 | Sonnet / alto | ☐ |
| S2-FE-04 | FE | Home do aluno (trilhas, progresso) em API real | 3 | BE-03, FE-02, FE-03 | Sonnet / médio | ☐ |
| S2-QA-02 | QA | E2E do núcleo + a11y | 3 | BE-03, FE-02, FE-03 | Sonnet / médio | ☐ |
| S2-SEG-02 | SEG | Revisão de segurança do motor/XP | 3 | BE-03 | Opus / alto | ☐ |
| S2-UX-02 | UX | Revisão UX/acessibilidade do player | 3 | FE-02, FE-03 | Sonnet / baixo | ☐ |
| S2-DEV-02 | DEV | Deploy staging do núcleo e smoke | 3 | BE-03, FE-04 | Sonnet / médio | ☐ |

**Caminho crítico:** BE-01 → DAD-02 → BE-02 → BE-03 → QA-02. Priorize estas.
**Premissas a ratificar na Onda 0 (BE-01/SEG-01):** XP e correção sempre no servidor (cliente nunca informa pontos); resposta correta só devolvida após a tentativa; atividade referencia uma habilidade (`codigo`) de `data/curriculo/`; conteúdo de atividade em JSON validado por Zod, versionado.

---

## Prompts por tarefa
> Cole na sessão do especialista **depois do prompt-base**. Cada um é autocontido.

### Onda 0

#### S2-BE-00 · Back-end · Dívida de segurança P1
```
Tarefa S2-BE-00 (Sprint 2, Onda 0). Leia: PEN-056, PEN-059, PEN-038 em PENDENCIAS.md; docs/seguranca/revisao-sprint-01.md (F-06, F-09);
apps/api/src (provedor de e-mail Fake, /dev/outbox), legacy/rotas/leads.js, docs/dados/migrar.md (§ Legado).
1. PEN-056: provedor Fake e /dev/outbox só em ENVIRONMENT dev/test (falham fechados em qualquer outro valor); outbox protegido; teste de que
   staging/production não expõem o outbox. (Coordene com DEV: workers_dev=false no topo, check:wrangler recusa deploy sem --env.)
2. PEN-038: upsert do lead com INSERT … ON CONFLICT (lower(email)) DO UPDATE … RETURNING id (SQL pronto em migrar.md). Telefone deixa de ser chave.
   Só funciona com a migration 0002 aplicada: documente a ordem de aplicação.
3. PEN-059: limite de tamanho/formato de nome/sobrenome/telefone/perfil; exigir Content-Type JSON + Origin; não devolver accessToken de lead
   pré-existente sem prova de posse.
Testes (tests/legado e apps/api). Não mexa em public/ nem em schema. Ao terminar: marque as PEN resolvidas (mover ao Arquivo) e handoff.
```

#### S2-BE-01 · Back-end · Contrato de catálogo, atividades e tentativas
```
Tarefa S2-BE-01 (Sprint 2, Onda 0). Leia: DECISOES.md (ADR-001), apps/api/openapi/auth.yaml (estilo), docs/dados/dicionario.md (tabelas do catálogo,
migration 0006), data/curriculo/README.md, docs/seguranca/lgpd-requisitos.md (só o que toca desempenho de menores).
Entregue, sem implementar:
1. apps/api/openapi/atividades.yaml (OpenAPI 3.1): GET catálogo (disciplinas → anos → habilidades), GET atividades por habilidade (paginado, cursor),
   POST início de sessão de prática, POST resposta/tentativa (correção no servidor; resposta correta só devolvida depois), GET progresso do aluno,
   GET XP. Erros, papéis permitidos (aluno), Idempotency-Key onde cabe (ADR-001 §3).
2. packages/shared-types: schemas Zod versionados do conteúdo de atividade — tipos `flashcard` e `lacuna` (campos, limites de tamanho, `habilidade`
   obrigatória, `versao`, dicas, texto alternativo para imagens futuras) — e tipos de tentativa/progresso/XP. Prever extensão para cruzadinha e
   mapa mental sem quebra.
3. Regras de XP e de repetição (versão simples: acerto de 1ª tentativa vale mais; teto diário a decidir com UX/SEG).
Publique como Contratos em COMUNICACAO.md (FE, DAD, PED, QA dependem). Handoff ≤5 linhas.
```

#### S2-DAD-01 · Dados · Modelo de atividades, tentativas e progresso
```
Tarefa S2-DAD-01 (Sprint 2, Onda 0). Leia: docs/dados/dicionario.md, db/migrations/0006_catalogo_curricular.sql, docs/dados/migrar.md,
docs/seguranca/lgpd-requisitos.md (retenção, minimização). Projete (documento + rascunho de SQL em docs/dados/, sem aplicar):
atividades (id ULID, tipo, habilidade, conteúdo JSON, versão, status rascunho/revisada/publicada, autor/revisor), sessões de prática,
tentativas (aluno, atividade, correta, tempo, nº da tentativa; sem texto livre do aluno persistido além do necessário), progresso por habilidade
(domínio, última prática), ledger de XP (append-only; saldo derivado). Índices para "próximas atividades do aluno" e relatórios futuros por turma.
Retenção/anonimização coerentes com RQ-19. Dicionário atualizado (campo, tipo, sensível?, retenção). Publique como Contrato em COMUNICACAO.md.
```

#### S2-UX-01 · UX/UI · Fluxo e wireframes do player
```
Tarefa S2-UX-01 (Sprint 2, Onda 0). Leia: docs/ux/principios.md, docs/ux/fluxos.md (§ homes), docs/ux/tokens.json.
Crie docs/ux/fluxos-aluno.md: home do aluno (trilhas por disciplina, progresso, XP), tela de atividade — flashcards (virar cartão, "sabia/não sabia",
revisão) e lacunas (arrastar/digitar, dica, feedback imediato certo/errado com explicação curta) —, fim de sessão (resumo, XP), estados vazios/erro/
offline leve. Wireframes ASCII mobile-first, tom por faixa etária (EF I/EF II/EM), acessibilidade (teclado, leitor de tela, sem depender de cor,
animações reduzíveis). Gamificação saudável: sem punição por erro, sem contador de vidas, teto de XP/dia sugerido. Sem código.
Publique como Contrato em COMUNICACAO.md (FE). Responda PEN-036 e PEN-046 se tocarem as telas.
```

#### S2-SEG-01 · Segurança · Requisitos do núcleo
```
Tarefa S2-SEG-01 (Sprint 2, Onda 0). Leia: docs/seguranca/threat-model.md, lgpd-requisitos.md (RQ-xx), revisao-sprint-01.md.
Crie docs/seguranca/requisitos-nucleo.md (≤80 linhas, SR-xx testáveis) para: correção e XP só no servidor, anti-trapaça (replay de tentativa,
tentativas em massa/automação, limite diário de XP, validação de `tempo`), IDOR (aluno só vê o próprio progresso), conteúdo de atividade (sanitização,
sem HTML/JS, limites de tamanho, versão imutável após publicada), telemetria sem PII, retenção de tentativas. Registre decisões pendentes em PENDENCIAS.md.
Publique como Contrato em COMUNICACAO.md.
```

#### S2-QA-01 · QA · Plano de testes do núcleo
```
Tarefa S2-QA-01 (Sprint 2, Onda 0). Leia: docs/qa/estrategia.md, docs/qa/convencoes.md, relatorio-sprint-01.md.
Crie docs/qa/plano-nucleo.md (≤60 linhas): casos de teste do motor de correção (unit com tabela de casos: acentos, maiúsculas, espaços, sinônimos
de lacuna), contratos (OpenAPI vs implementação), E2E do fluxo do aluno, a11y (axe + teclado), dados sintéticos (fixtures de atividades),
critérios de aceite, matriz de risco. Sem código.
```

#### S2-DEV-01 · DevOps · Staging real
```
Tarefa S2-DEV-01 (Sprint 2, Onda 0). Leia: docs/devops/ambientes.md (§4, §8), docs/devops/runbook.md, PEN-002/033/034/037/039/045/047.
Com os pré-requisitos humanos feitos (confirme com o usuário; se não, produza o checklist exato e pare): preencher IDs reais nos wrangler.toml,
aplicar db/migrations + seeds em staging, configurar Turnstile (site key por ambiente), integrar o provedor de e-mail escolhido em Deps.enviarEmail
(apps/api/src/deps.ts) apenas com a configuração/secret (código do provedor é do BE: PEDIDO), ligar no CI `gerar-curriculo.mjs --check` e a
aplicação de migrations do zero (PEN-039) e `node --test tests/legado` (PEN-037). Atualize runbook. Valide com o smoke em staging.
```

### Onda 1

#### S2-DAD-02 · Dados · Migrations e seed do catálogo
```
Tarefa S2-DAD-02 (Sprint 2, Onda 1). Leia: contratos de DAD-01 e BE-01 (COMUNICACAO.md), db/migrations/, db/seeds/.
Implemente db/migrations/0007+ (imutáveis) conforme o modelo aprovado, índices e constraints; seed idempotente de atividades-modelo a partir de
data/conteudo/ (gerador com --check, como db/seeds/gerar-curriculo.mjs). Aplique do zero em D1 local e valide. Atualize docs/dados/dicionario.md e
migrar.md. Avise BE (AVISO) com os nomes finais das tabelas.
```

#### S2-BE-02 · Back-end · API de catálogo e atividades
```
Tarefa S2-BE-02 (Sprint 2, Onda 1). Leia: apps/api/openapi/atividades.yaml, schemas Zod de shared-types, dicionário (DAD-01), requisitos-nucleo.md,
estrutura de apps/api/src (rotas/ servicos/ policy). Implemente GET catálogo e GET atividades (só `publicada`, paginação por cursor, sem devolver
gabarito), com autorização por papel, cache de leitura do currículo em KV (ADR-001) e testes (unit + integração no pool do workerd, casos negativos).
Siga o OpenAPI; mudança = nova versão + AVISO. Migrations são do DAD (PEDIDO).
```

#### S2-FE-01 · Front-end · Base do player
```
Tarefa S2-FE-01 (Sprint 2, Onda 1). Leia: docs/ux/fluxos-aluno.md, packages/ui (README), apps/web/src (paginas/, api/, mocks/), openapi/atividades.yaml.
Implemente em apps/web o shell da prática: rota /praticar/:habilidade, cliente tipado (shared-types) com MSW, estado da sessão de prática, barra de
progresso, componente de feedback acertou/errou (não depender de cor, aria-live), tela de resumo. Componentes reutilizáveis novos vão em packages/ui.
Testes de componente. Não implemente os tipos de atividade (FE-02/FE-03).
```

#### S2-PED-01 · Pedagogia · Catálogo piloto e atividades-modelo
```
Tarefa S2-PED-01 (Sprint 2, Onda 1). Leia: data/curriculo/README.md, schemas de atividade (shared-types, contrato BE-01), PEN-019.
1. Complete data/curriculo/ para o piloto (LP e MA do 5º ano) marcando `validar` apenas onde houver dúvida; documente o que depende de conferência
   humana contra o PDF oficial.
2. Crie data/conteudo/ com 30 atividades-modelo (15 flashcards + 15 lacunas) distribuídas entre as habilidades, no formato do contrato, com
   gabarito, explicação curta de feedback, dica, nível de dificuldade e linguagem adequada ao 5º ano. Status `rascunho`.
3. data/conteudo/README.md: guia de autoria (rubrica de qualidade, erros comuns, acessibilidade, o que NÃO usar: marcas, dados pessoais, material
   protegido). Validar contra o schema Zod com o script indicado pelo BE. Sem código de aplicação.
```

### Onda 2

#### S2-BE-03 · Back-end · Motor de correção, tentativas, progresso e XP
```
Tarefa S2-BE-03 (Sprint 2, Onda 2). Leia: atividades.yaml, requisitos-nucleo.md (SR-xx), dicionário e migrations 0007+, apps/api/src.
Implemente: início de sessão de prática, correção no servidor para flashcard e lacuna (normalização de acentos/caixa/espaços, múltiplas respostas
aceitas), registro de tentativa idempotente, atualização de progresso por habilidade, ledger de XP append-only com teto diário, endpoints de
progresso/XP; auditoria sem PII; rate limit contra automação. Gabarito nunca sai antes da tentativa. Testes: tabela de casos do motor (QA-01),
concorrência (tentativas simultâneas), IDOR. Handoff com variáveis/bindings novos.
```

#### S2-FE-02 · Front-end · Player de flashcards
```
Tarefa S2-FE-02 (Sprint 2, Onda 2). Leia: fluxos-aluno.md (flashcards), componentes da FE-01, contrato de atividades.
Implemente o player de flashcards: virar cartão (clique/Enter/Espaço), "sabia / não sabia / quase", reordenação para revisão, leitor de tela,
`prefers-reduced-motion`, alvos de toque ≥44px. Consuma a API real quando disponível; MSW antes. Testes de componente + a11y (axe).
```

#### S2-FE-03 · Front-end · Player de lacunas
```
Tarefa S2-FE-03 (Sprint 2, Onda 2). Leia: fluxos-aluno.md (lacunas), componentes da FE-01, contrato de atividades.
Implemente o player de preenchimento de lacunas (digitar e/ou escolher; dica; feedback imediato com explicação curta; navegação por teclado; ARIA
correto; sem revelar o gabarito antes da tentativa). MSW antes da API real. Testes de componente + a11y (axe).
```

#### S2-PED-02 · Pedagogia · 100 atividades revisadas
```
Tarefa S2-PED-02 (Sprint 2, Onda 2). Leia: data/conteudo/README.md, atividades-modelo, API de catálogo (para validar o carregamento).
Complete 100 atividades (LP e MA, 5º ano) cobrindo todas as habilidades do piloto, com revisão cruzada (checklist da rubrica por atividade),
variação de dificuldade e distratores plausíveis. Passe-as a `revisada` e deixe `publicada` somente quando PEN-019 estiver resolvido (humano):
registre o estado em data/conteudo/STATUS.md. Valide com o script de schema. Sem código de aplicação.
```

### Onda 3

#### S2-FE-04 · Front-end · Home do aluno
```
Tarefa S2-FE-04 (Sprint 2, Onda 3). Leia: fluxos-aluno.md (home), endpoints de catálogo/progresso/XP.
Implemente a home do aluno em API real: trilhas por disciplina, progresso por habilidade, XP total/do dia, "continuar de onde parou". Estados vazio/
erro/carregando; sem ranking nem streaks. Troque os mocks pelos endpoints reais (alternável por env). Testes.
```

#### S2-QA-02 · QA · E2E do núcleo
```
Tarefa S2-QA-02 (Sprint 2, Onda 3). Leia: docs/qa/plano-nucleo.md, docs/qa/convencoes.md, requisitos-nucleo.md.
Escreva E2E (Playwright, contra preview/staging): login → home → praticar flashcards → praticar lacunas → resumo/XP; erro de resposta; teto de XP;
tentativas repetidas; acesso indevido (outro aluno, sem login); a11y (axe + teclado). Defeitos → PENDENCIAS com passos. Relatório em
docs/qa/relatorio-sprint-02.md (≤40 linhas).
```

#### S2-SEG-02 · Segurança · Revisão do motor/XP
```
Tarefa S2-SEG-02 (Sprint 2, Onda 3). Revise (leitura) apps/api (motor, tentativas, XP), migrations, e as telas contra requisitos-nucleo.md
(SR-xx): gabarito exposto, replay/automação, fraude de XP, IDOR, logs com PII, XSS por conteúdo de atividade, CSP. Produza
docs/seguranca/revisao-sprint-02.md (severidade, local, correção sugerida). Crítico/alto → BLOQUEIO em COMUNICACAO.md; demais → PENDENCIAS.md.
Não corrija você mesmo.
```

#### S2-UX-02 · UX/UI · Revisão do player
```
Tarefa S2-UX-02 (Sprint 2, Onda 3). Revise as telas de prática e a home contra fluxos-aluno.md, principios.md e WCAG 2.2 AA (contraste, foco,
teclado, leitor de tela, movimento reduzido, linguagem por faixa etária, feedback sem punição). Produza docs/ux/revisao-sprint-02.md e registre
defeitos em PENDENCIAS.md (1 linha cada). Sem código.
```

#### S2-DEV-02 · DevOps · Deploy staging do núcleo
```
Tarefa S2-DEV-02 (Sprint 2, Onda 3). Aplique migrations e seeds em staging, faça o deploy pelo Workers Builds (node scripts/deploy.mjs staging),
rode o smoke e o E2E contra staging, atualize o runbook (novas migrations/seeds, rollback) e informe a URL ao usuário. Se faltar pré-requisito
humano, liste exatamente o que falta.
```

---

## Fechamento da sprint (coordenador/usuário)
- [ ] Todas as tarefas ☑, CI verde, E2E verde, staging validado.
- [ ] `COMUNICACAO.md` arquivado em `sprints/arquivo/COMUNICACAO-SPRINT-02.md` e zerado (manter Contratos vigentes).
- [ ] `PENDENCIAS.md` triado; `BACKLOG.md` atualizado (v0.2 ☑); decisões em `DECISOES.md`.
- [ ] Gerar `SPRINT-03.md` (v0.3 Painel do professor).
- [ ] **Encerrar todas as sessões** e abrir novas na próxima sprint.
