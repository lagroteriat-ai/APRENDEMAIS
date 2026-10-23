# BACKLOG — Plataforma Aprende+

> Fonte única do plano de versões. **Não leia inteiro numa sessão de especialista**: leia só o item da sua tarefa (busque pelo ID). Tarefas detalhadas e prompts ficam em `sprints/SPRINT-NN.md`.

## Visão
Plataforma educacional inteligente que funciona como **banco de atividades gamificadas e interativas** para Ensino Fundamental I, II e Médio. Não é um jogo: aplica metodologias ativas e neurociência (prática de recuperação, repetição espaçada, feedback imediato, intercalação) em formatos dinâmicos — flashcards, preenchimento de lacunas, mapas mentais, cruzadinhas — com apoio visual (GIFs/memes).

- **Interface do aluno:** disciplinas alinhadas à **BNCC** e ao **currículo de Pernambuco**.
- **Interface do professor:** gestão de turmas, atribuição de atividades e acompanhamento pedagógico dos resultados.
- **Rankings:** escolar, municipal e global, apenas de usuários ativos.
- Referência de produto: Seneca Learning.
- Substitui o protótipo externo (`manus.space`) e a landing de leads atual (continua no ar até a v1.0).

## Princípios
1. **LGPD by design** (público com menores): minimização de dados, consentimento parental, ranking opt-in/pseudônimo, direito de exclusão/exportação.
2. **Pedagogia primeiro:** toda atividade mapeia para uma habilidade BNCC/PE.
3. **Contrato antes de implementação:** APIs, schemas e tokens são publicados em `COMUNICACAO.md` para destravar trabalho paralelo.
4. **Economia de tokens:** documentos curtos, estado persistido em `.md`, sessões reiniciadas por sprint.

## Stack alvo (confirmada em ADR-001, Sprint 1)
Cloudflare Workers (API Hono + SPA via Static Assets; sem Pages — ADR-002), D1 (relacional), R2 (mídia), KV (cache/sessões), Durable Objects/Queues (ranking, filas), Turnstile, Access (admin). Front-end SPA (proposta: React + Vite + TypeScript), a confirmar no ADR.

## Legenda
Estimativa: **P** (≤0,5 dia) · **M** (1–2 dias) · **G** (3+ dias). Especialistas: BE Back-end · FE Front-end · DEV DevOps · DAD Dados · SEG Segurança · PED Pedagogia/Conteúdo · UX UX/UI & Gamificação · QA Testes.
Status: ☐ pendente · ◐ em sprint · ☑ concluído.

---

## v0.1 — Fundação (Sprint 1) → `sprints/SPRINT-01.md`
| ID | Item | Esp. | Est. | Dep. | Aceite |
|---|---|---|---|---|---|
| V01-BE-00 | Hotfix da landing: rota admin, auth do prototype-access, erros sem `detail` | BE | M | — | Painel admin lista leads; endpoints sem vazamento |
| V01-BE-05 | Migrar a landing de Pages Functions para Worker + Static Assets (ADR-002) | BE | M | BE-01 | Landing e admin funcionam via `wrangler deploy`; só arquivos da landing publicados |
| V01-BE-01 | ADR de arquitetura/stack e convenções de API | BE | M | — | ADR-001 em `DECISOES.md` |
| V01-SEG-01 | Requisitos LGPD/menores | SEG | M | — | `docs/seguranca/lgpd-requisitos.md` |
| V01-UX-01 | Fluxos aluno/professor e design tokens | UX | M | — | `docs/ux/fluxos.md` + tokens |
| V01-QA-01 | Estratégia de testes | QA | P | — | `docs/qa/estrategia.md` |
| V01-PED-01 | Taxonomia BNCC/PE inicial | PED | M | — | `data/curriculo/` validado |
| V01-DEV-01 | Monorepo, CI/CD, ambientes | DEV | G | BE-01 | CI verde, preview por PR |
| V01-DAD-01 | Schema D1 base + migrations | DAD | M | BE-01, SEG-01 | Migrations aplicam do zero |
| V01-BE-02 | Contrato de API de auth/consentimento | BE | P | BE-01, SEG-01 | Publicado em `COMUNICACAO.md` |
| V01-FE-01 | Design system base | FE | M | UX-01, BE-01 | Componentes + tokens |
| V01-SEG-02 | Threat model | SEG | M | BE-01, SEG-01 | `docs/seguranca/threat-model.md` |
| V01-BE-03 | Auth, sessões e papéis | BE | G | DEV-01, DAD-01, BE-02 | Testes passam |
| V01-BE-04 | Consentimento parental (API) | BE | M | DEV-01, DAD-01, BE-02 | Menor sem consentimento é bloqueado |
| V01-FE-02 | Telas de login/cadastro/consentimento | FE | M | FE-01, BE-02 | Fluxo funciona contra mock |
| V01-DAD-02 | Migration UNIQUE de leads + seed da taxonomia | DAD | M | DAD-01, PED-01 | Sem duplicatas |
| V01-SEG-03 | Turnstile + rate limit na landing | SEG | M | DEV-01 | Cadastro protegido |
| V01-PED-02 | Linguagem de consentimento/privacidade p/ menores | PED | P | SEG-01 | Texto aprovado |
| V01-QA-02 | Base de testes automatizados | QA | M | QA-01, DEV-01 | Suíte roda no CI |
| V01-QA-03 | E2E cadastro → consentimento → login | QA | M | BE-03, BE-04, FE-02 | E2E verde |
| V01-SEG-04 | Revisão de segurança do auth | SEG | M | BE-03, BE-04, SEG-03 | Achados tratados/registrados |
| V01-UX-02 | Revisão UX/acessibilidade das telas | UX | P | FE-02 | Checklist WCAG |
| V01-DEV-02 | Staging e runbook de deploy | DEV | M | DEV-01, BE-03 | Staging no ar |

## v0.2 — Núcleo do aluno
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V02-DAD-01 | Modelo de catálogo (disciplina → ano → habilidade → atividade) | DAD | M | V01-DAD-01 |
| V02-PED-01 | Catálogo BNCC/PE completo de 2 disciplinas-piloto (Português, Matemática) | PED | G | V01-PED-01 |
| V02-BE-01 | API de catálogo e de atividades | BE | M | V02-DAD-01 |
| V02-BE-02 | Motor de atividades (schema de conteúdo + correção) | BE | G | V02-BE-01 |
| V02-UX-01 | Fluxo e protótipo do player (flashcards e lacunas) | UX | M | V01-UX-01 |
| V02-FE-01 | Player de flashcards | FE | M | V02-BE-02, V02-UX-01 |
| V02-FE-02 | Player de preenchimento de lacunas | FE | M | V02-BE-02, V02-UX-01 |
| V02-BE-03 | Registro de tentativas, progresso e XP | BE | M | V02-BE-02 |
| V02-FE-03 | Home do aluno (trilhas, progresso) | FE | M | V02-BE-03 |
| V02-PED-02 | 100 atividades-piloto revisadas | PED | G | V02-BE-02 |
| V02-QA-01 | Testes de motor e E2E do player | QA | M | V02-FE-01 |

## v0.3 — Painel do professor
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V03-DAD-01 | Modelo de turma, matrícula e atribuição | DAD | M | V01-DAD-01 |
| V03-BE-01 | API de turmas, convites e atribuição | BE | G | V03-DAD-01 |
| V03-DAD-02 | Agregações de desempenho por habilidade/turma | DAD | M | V02-BE-03 |
| V03-BE-02 | API de relatórios pedagógicos | BE | M | V03-DAD-02 |
| V03-UX-01 | Fluxos e wireframes do professor | UX | M | — |
| V03-FE-01 | Gestão de turmas e atribuição | FE | G | V03-BE-01, V03-UX-01 |
| V03-FE-02 | Relatórios e exportação (CSV/PDF) | FE | M | V03-BE-02 |
| V03-SEG-01 | Autorização por vínculo professor↔turma↔escola | SEG | M | V03-BE-01 |
| V03-QA-01 | E2E do ciclo professor→aluno→relatório | QA | M | V03-FE-02 |

## v0.4 — Mais formatos e mídia
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V04-BE-01 | Schema e correção de cruzadinhas | BE | M | V02-BE-02 |
| V04-BE-02 | Schema e correção de mapas mentais | BE | G | V02-BE-02 |
| V04-FE-01 | Player de cruzadinhas | FE | G | V04-BE-01 |
| V04-FE-02 | Player/editor de mapas mentais | FE | G | V04-BE-02 |
| V04-DEV-01 | Pipeline de mídia (R2, otimização, CDN) | DEV | M | — |
| V04-SEG-01 | Moderação e licenciamento de GIFs/memes | SEG | M | V04-DEV-01 |
| V04-PED-01 | Curadoria de mídia e conteúdo para 4 disciplinas adicionais | PED | G | V04-SEG-01 |
| V04-UX-01 | Linguagem visual de memes/GIFs sem prejuízo pedagógico | UX | M | — |

## v0.5 — Gamificação e retenção
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V05-UX-01 | Mecânicas: streak, conquistas, metas (evitar manipulação/dependência) | UX | M | — |
| V05-DAD-01 | Modelo de streaks, conquistas e agenda de revisão | DAD | M | V02-BE-03 |
| V05-BE-01 | Repetição espaçada (agendador de revisões) | BE | G | V05-DAD-01 |
| V05-BE-02 | Conquistas, streaks e metas diárias | BE | M | V05-DAD-01 |
| V05-FE-01 | UI de conquistas, streak e metas | FE | M | V05-BE-02, V05-UX-01 |
| V05-FE-02 | Fila de revisão diária | FE | M | V05-BE-01 |
| V05-PED-01 | Validação pedagógica das mecânicas | PED | P | V05-UX-01 |

## v0.6 — Rankings
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V06-SEG-01 | Política de privacidade do ranking (opt-in, pseudônimo, menores) | SEG | M | — |
| V06-DAD-01 | Definição de "usuário ativo" e modelo de pontuação | DAD | M | V06-SEG-01 |
| V06-BE-01 | Agregação de ranking escola/município/global (Durable Objects/cron) | BE | G | V06-DAD-01 |
| V06-SEG-02 | Anti-fraude e anti-abuso de pontuação | SEG | M | V06-BE-01 |
| V06-FE-01 | Telas de ranking | FE | M | V06-BE-01 |
| V06-QA-01 | Testes de carga e consistência | QA | M | V06-BE-01 |

## v0.7 — Gestão e dados
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V07-DAD-01 | Modelo analítico (agregados por escola/município) | DAD | G | V03-DAD-02 |
| V07-BE-01 | API de gestor escolar e secretaria | BE | M | V07-DAD-01 |
| V07-FE-01 | Painel do gestor | FE | G | V07-BE-01 |
| V07-DEV-01 | Observabilidade (logs, métricas, alertas) | DEV | M | — |
| V07-SEG-01 | Auditoria de acessos a dados de alunos | SEG | M | V07-BE-01 |

## v0.8 — Hardening e beta
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V08-SEG-01 | Pentest e correções | SEG | G | — |
| V08-QA-01 | Teste de carga e regressão completa | QA | G | — |
| V08-UX-01 | Auditoria WCAG 2.2 AA | UX | M | — |
| V08-BE-01 | Exportação e exclusão de dados do titular (LGPD) | BE | M | — |
| V08-DEV-01 | Backup/restore e plano de recuperação | DEV | M | — |
| V08-PED-01 | Beta com escolas piloto e coleta de feedback | PED | G | — |

## v1.0 — Lançamento
| ID | Item | Esp. | Est. | Dep. |
|---|---|---|---|---|
| V10-DAD-01 | Migração de leads da landing para a plataforma | DAD | M | — |
| V10-DEV-01 | Domínio, produção e desligamento do protótipo | DEV | M | — |
| V10-BE-01 | Remoção do código legado da landing (`functions/` antigas) | BE | P | V10-DAD-01 |
| V10-PED-01 | Material de onboarding para professores | PED | M | — |
| V10-QA-01 | Checklist final de go-live | QA | P | — |

---

## Riscos e questões em aberto
| # | Tema | Ação sugerida |
|---|---|---|
| R1 | Licenciamento do conteúdo e dados da BNCC/currículo PE | PED confirma fontes oficiais abertas (V01-PED-01) |
| R2 | Direitos de uso de GIFs/memes | Apenas mídia própria/licenciada; moderação (V04-SEG-01) |
| R3 | Ranking exposto a menores | Opt-in + pseudônimo (V06-SEG-01) |
| R4 | Vínculo escola↔município: de onde vem o cadastro oficial? | Decidir fonte (INEP/secretaria) na v0.3 |
| R5 | Limites do D1 (tamanho/consultas) para ranking global | Validar com carga na v0.6; plano B: agregados em DO/KV |
| R6 | Custo de tokens/sessões | Ver regras em `ESPECIALISTAS.md` |
