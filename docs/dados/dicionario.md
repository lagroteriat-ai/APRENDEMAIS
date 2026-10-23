# Dicionário de dados — D1 da plataforma (v1.1 do contrato "Schema D1 base")

Dono: DAD · Consumidores: BE (repos), SEG, QA · Fonte: `db/migrations/0001..0006` (+ `db/seeds/curriculo.sql`) e, para o banco legado, `migrations/0001..0002` · Requisitos: `docs/seguranca/lgpd-requisitos.md` (RQ-nn) · Convenções: `DECISOES.md#adr-001` §3.
Banco **novo e separado** do D1 da landing (ADR-001 §5). A tabela `leads` mora no banco legado e está descrita no fim deste arquivo (§ Banco legado).

## Legenda
- **Tipo:** `ULID` = TEXT de 26 caracteres gerado na API (CHECK `length(id)=26`) · `ISO` = TEXT ISO-8601 UTC com `Z` e milissegundos (`2026-10-22T14:03:00.000Z`; a ordem textual = ordem cronológica) · `HASH` = TEXT hexadecimal de 64 caracteres (SHA-256/HMAC-SHA256).
- **Sensível?** Nenhum campo é dado sensível do art. 5º II da LGPD (RQ-12). Classe: `—` não pessoal · `Pessoal` · `Menor` pessoal de titular < 18 (alto cuidado: nunca em log, URL ou analytics) · `Segredo` credencial/token (só hash; nunca em log).
- **Obrig.:** Sim · Não · Cond. (depende do papel/estado; regra citada).
- **Retenção:** ver §Retenção. `conta` = enquanto a conta existir, apagado/anonimizado na exclusão (RQ-14).
- Toda coluna existe por uma **finalidade** (RQ-11). Campo novo = nova migration + linha aqui.

## usuarios
Conta de qualquer papel. Aluno é identificado por `apelido` (login, DU-01); aluno < 18 não tem e-mail.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave opaca usada em todos os vínculos, logs e rankings | permanente (a linha vira tombstone) |
| papel | TEXT: aluno, responsavel, professor, gestor, admin | Sim | — | Papel principal (RBAC, RQ-35); extras em `usuario_papeis` | conta |
| status | TEXT: pendente_responsavel, pendente_email, ativa, suspensa_exclusao, apagada | Sim | — | Máquina de estados da conta (`docs/ux/fluxos.md` §3); só `ativa` acessa | permanente |
| ativo | INTEGER (coluna gerada = `status='ativa'`) | — | — | Atalho de leitura para o "ativo" do contrato; não gravável | permanente |
| apelido | TEXT 3–32, só `A-Za-z0-9`, único sem diferenciar caixa | Cond.: obrigatório para aluno | Menor | Login do aluno, gerado pelo servidor. É **privado** (DC-10 do contrato de auth): o ranking futuro terá um apelido público próprio (RQ-22) | conta |
| nome | TEXT ≤120 | Cond.: obrigatório para não-aluno; **proibido para aluno** | Pessoal | Identificar professor/gestor/admin/responsável (RQ §3) | conta |
| email | TEXT ≤254, minúsculas, único | Cond.: obrigatório para não-aluno e aluno ≥ 18; ausente para aluno < 18 | Pessoal | Login, confirmação de e-mail, recuperação | conta |
| credencial_hash | TEXT `pbkdf2-sha256$iter$salt$hash` | Sim (exceto `apagada`) | Segredo | Autenticar (ADR-001 §4); nunca a senha | conta |
| nascimento_ym | TEXT `AAAA-MM` | Cond.: obrigatório para aluno | Menor | Calcular a idade e decidir o consentimento parental (RQ-02, RQ-03); só mês/ano | conta |
| ano_escolar | TEXT: EF1..EF9, EM1..EM3 | Cond.: obrigatório para aluno | Menor | Adequar conteúdo e turma (RQ §3) | conta |
| sessao_versao | INTEGER ≥1 | Sim (padrão 1) | — | Revogar sessões em KV na hora: trocar senha/papel/consentimento incrementa; sessão com versão antiga é inválida | conta |
| criado_em | ISO | Sim | — | Expirar pré-cadastro em 7 dias (RQ-05) | conta |
| atualizado_em | ISO | Sim | — | Controle de concorrência/diagnóstico (app grava) | conta |
| ultimo_acesso_em | ISO | Não | — | Inatividade de 12 meses (RQ-19); gravar só no login, não por requisição | conta |
| exclusao_solicitada_em | ISO | Cond.: obrigatório se `suspensa_exclusao` | — | Cumprir o prazo de 15 dias (RQ-14) | conta |

Regras garantidas pelo banco: aluno ativo/pendente tem apelido, nascimento e ano escolar e **nunca** `nome`; `pendente_responsavel` só existe para aluno; `apagada` (tombstone) tem todos os campos pessoais nulos. Exclusão **não** apaga a linha: anonimiza (mantém `id`) para pontuações/rankings anonimizados; pré-cadastro expirado é apagado (DELETE), com cascata.

## usuario_papeis
Papéis **adicionais** (papel efetivo = `usuarios.papel` ∪ esta tabela; o principal não se repete aqui — regra de aplicação).
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| usuario_id | ULID → usuarios (CASCADE) | Sim | — | Dono do papel | conta |
| papel | TEXT (mesma lista) | Sim | — | Papel extra (T15 "Escolher papel"). `admin` só por seed/CLI | conta |
| concedido_por | ULID → usuarios (SET NULL) | Não | — | Quem concedeu (RQ-34) | conta |
| concedido_em | ISO | Sim | — | Quando | conta |

## municipios
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | permanente |
| codigo_ibge | TEXT 7 dígitos, único | Sim | — | Identificar o município sem ambiguidade (ranking por município, RQ-23) | permanente |
| nome | TEXT ≤100 | Sim | — | Exibição | permanente |
| uf | TEXT 2 letras (padrão `PE`) | Sim | — | Escopo geográfico | permanente |
| criado_em | ISO | Sim | — | Diagnóstico | permanente |

## escolas
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | permanente |
| municipio_id | ULID → municipios (RESTRICT) | Sim | — | Escopo município do ranking (RQ-23); município do aluno é derivado por matrícula → turma → escola | permanente |
| nome | TEXT ≤150 | Sim | — | Exibição; único dentro do município | permanente |
| codigo_inep | TEXT 8 dígitos, único | Não | — | Casar com o cadastro oficial (Censo Escolar) | permanente |
| ativa | INTEGER 0/1 | Sim (padrão 1) | — | Desativar sem apagar | permanente |
| criado_em | ISO | Sim | — | Diagnóstico | permanente |

## escola_membros
Professor/gestor em uma escola (RQ-36). Remover o vínculo = apagar a linha (a trilha fica em `auditoria_acesso`).
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| escola_id | ULID → escolas (CASCADE) | Sim | — | Escopo de acesso do gestor/professor | enquanto o vínculo existir |
| usuario_id | ULID → usuarios (CASCADE) | Sim | Pessoal | Quem é membro | idem |
| papel | TEXT: professor, gestor | Sim | — | Papel na escola (PK = escola+usuário+papel) | idem |
| criado_em | ISO | Sim | — | Diagnóstico | idem |

## convites
Convite de professor/gestor (72 h, uso único, preso a e-mail + escola). O token só existe no e-mail enviado.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | ver §Retenção |
| escola_id | ULID → escolas (CASCADE) | Sim | — | Escola do convite | idem |
| email | TEXT minúsculas | Sim | Pessoal | Destinatário; o cadastro exige o mesmo e-mail | idem |
| papel | TEXT: professor, gestor | Sim | — | Papel concedido | idem |
| token_hash | HASH, único | Sim | Segredo | Validar o link sem guardar o token | idem |
| criado_por | ULID → usuarios (SET NULL) | Não | — | Quem convidou (auditável; nulo = seed/CLI) | idem |
| criado_em, expira_em | ISO | Sim | — | Validade de 72 h | idem |
| aceito_em, aceito_por | ISO, ULID → usuarios (SET NULL) | Não | — | Uso único e quem aceitou | idem |

## turmas
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | permanente |
| escola_id | ULID → escolas (RESTRICT) | Sim | — | Escopo escola | permanente |
| nome | TEXT ≤60 | Sim | — | Ex.: "5º A" (único por escola e ano letivo) | permanente |
| ano_escolar | TEXT (mesma lista de usuarios) | Sim | — | Série da turma | permanente |
| ano_letivo | INTEGER 2020–2100 | Sim | — | Separar turmas ao longo dos anos | permanente |
| arquivada_em | ISO | Não | — | Encerrar a turma sem apagar histórico | permanente |
| criado_em | ISO | Sim | — | Diagnóstico | permanente |

## turma_professores
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| turma_id | ULID → turmas (CASCADE) | Sim | — | Turma | enquanto o vínculo existir |
| professor_id | ULID → usuarios (CASCADE) | Sim | Pessoal | Professor que vê a turma (RQ-36); deve ser membro da escola (regra de aplicação) | idem |
| criado_em | ISO | Sim | — | Diagnóstico | idem |

## matriculas
Vínculo aluno–turma por convite/aceite (RQ-36): `pendente` → `ativa` → `encerrada`.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | conta |
| turma_id | ULID → turmas (RESTRICT) | Sim | — | Turma | conta |
| aluno_id | ULID → usuarios (CASCADE) | Sim | Menor | Aluno | conta (apagada na exclusão) |
| status | TEXT: pendente, ativa, encerrada | Sim | — | Estado do vínculo; no máx. um vigente por aluno+turma | conta |
| criado_em | ISO | Sim | — | Quando foi convidado | conta |
| aceita_em | ISO | Cond.: obrigatório se `ativa` | — | Prova do aceite | conta |
| encerrada_em | ISO | Cond.: obrigatório se `encerrada` | — | Fim do acesso do professor aos dados (RQ-36) | conta |

## responsaveis_vinculos
Quem responde por um aluno. Responsável **não tem conta** no Sprint 1 (DU-02). Apagado junto com o aluno (RQ-05, RQ-14).
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | conta |
| aluno_id | ULID → usuarios (CASCADE) | Sim | Menor | Aluno representado | conta |
| responsavel_usuario_id | ULID → usuarios (SET NULL) | Não | — | Reservado para responsável com conta (versão futura) | conta |
| responsavel_email | TEXT minúsculas | Sim | Pessoal | Enviar link de consentimento, gerenciar e recuperação do menor (DU-03); único por aluno | conta; **7 dias** se o consentimento não for dado (RQ-05) |
| responsavel_nome | TEXT ≤120 | Não (informado em T06) | Pessoal | Registrar quem consentiu | conta |
| confirmado_em | ISO | Não | — | Verificação do responsável (RQ-04) | conta |
| criado_em | ISO | Sim | — | Prazo de 7 dias | conta |

## consentimentos
Uma linha por concessão; reconceder após revogar cria **nova linha**. `usuario_id` = titular dos dados (o aluno). No máximo um vigente (`pendente`/`concedido`) por aluno e finalidade.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | ver §Retenção |
| usuario_id | ULID → usuarios (CASCADE) | Sim | Menor | Titular | idem |
| vinculo_id | ULID → responsaveis_vinculos (SET NULL) | Não (nulo se `concedido_por='titular'`) | — | Quem consentiu; vira nulo se o vínculo for apagado | idem |
| finalidade | TEXT: uso_plataforma, ranking | Sim | — | Consentimento específico por finalidade; ranking é opt-in separado (RQ-21) | idem |
| concedido_por | TEXT: responsavel, titular | Sim | — | Menor → responsável (RQ-03); ≥18 → o próprio | idem |
| versao_texto | TEXT ≤40, ex.: `aviso-responsavel@1.0` | Sim | — | Prova do texto aceito (RQ-06); o texto fica versionado fora do banco | idem |
| status | TEXT: pendente, concedido, recusado, revogado, expirado | Sim | — | Estado; só `concedido` libera o acesso (RQ-03) | idem |
| solicitado_em | ISO | Sim | — | Quando foi pedido | idem |
| expira_em | ISO | Cond.: obrigatório se `pendente` | — | Prazo de 7 dias (RQ-04/05) | idem |
| decidido_em | ISO | Cond.: obrigatório se concedido/recusado/revogado | — | Data do consentimento | idem |
| revogado_em | ISO | Cond.: obrigatório se `revogado` | — | Revogação (RQ-07) | idem |
| ip_hash | HASH | Não | Pessoal | Evidência sem guardar o IP: HMAC-SHA256 do IP com segredo do servidor (`IP_HASH_SECRET`, novo segredo). Zerar na anonimização | idem |

## tokens_acao
Links de uso único por e-mail. Só o hash fica no banco. Limite de reenvio = contar linhas de (`usuario_id`,`tipo`) nas últimas 24 h.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave | **7 dias** após `expira_em` |
| usuario_id | ULID → usuarios (CASCADE) | Sim | Menor | Dono do link | idem |
| consentimento_id | ULID → consentimentos (CASCADE) | Cond.: obrigatório nos tipos `consentimento` e `gerenciar_consentimento`; proibido nos demais | — | Link aponta o consentimento | idem |
| tipo | TEXT: consentimento, gerenciar_consentimento, recuperacao_senha, confirmacao_email | Sim | — | Finalidade do link | idem |
| token_hash | HASH, único | Sim | Segredo | Validar sem guardar o token (256 bits aleatórios, SHA-256) | idem |
| criado_em, expira_em | ISO | Sim | — | Validade (consentimento 7 d, gerenciar 30 d, recuperação 30 min, confirmação de e-mail 7 d — BE-02) | idem |
| consumido_em | ISO | Não | — | Uso único; também marca link substituído por outro mais novo | idem |

## auditoria_acesso
Trilha **append-only** (RQ-31). UPDATE é bloqueado por trigger (exceto `ator_id`, que o banco zera ao apagar o usuário); DELETE só pela rotina de retenção. **Sem PII.**
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | ULID | Sim | — | Chave (ordem cronológica) | ≥ 12 meses |
| ator_id | ULID → usuarios (SET NULL) | Não (nulo = sistema/ator apagado) | — | Quem agiu | idem |
| ator_papel | TEXT: papéis + `sistema` | Sim | — | Papel usado na ação | idem |
| acao | TEXT 3–60, `dominio.verbo` | Sim | — | O que foi feito. Catálogo inicial: `aluno.ler`, `aluno.exportar`, `conta.exclusao_solicitar`, `conta.anonimizar`, `pre_cadastro.apagar`, `papel.alterar`, `consentimento.conceder`, `consentimento.recusar`, `consentimento.revogar`, `vinculo.remover`, `convite.emitir`, `admin.ler_dados` | idem |
| alvo_tipo | TEXT ≤40 | Sim | — | Tipo do alvo (`usuario`, `turma`…) | idem |
| alvo_id | TEXT ≤64, sem FK | Não | — | ID opaco do alvo; sobrevive à exclusão dele | idem |
| motivo | TEXT ≤300 | Não (exigido pela API para `admin`, RQ-34) | — | Justificar acesso; texto livre **sem dados pessoais** | idem |
| request_id | TEXT ≤64 | Não | — | Correlacionar com logs (`X-Request-Id`) | idem |
| criado_em | ISO | Sim | — | Quando | idem |

## idempotency_keys
`Idempotency-Key` (ADR-001 §3). Mesma chave + corpo diferente → 409 `IDEMPOTENCY_CONFLICT`.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| escopo | TEXT ≤120 | Sim | — | Método + rota (+ id do usuário nas rotas autenticadas); parte da PK | **24 h** (TTL) |
| chave | TEXT 16–64 (UUID) | Sim | — | Chave enviada pelo cliente; parte da PK | idem |
| corpo_hash | HASH | Sim | — | Detectar reuso com corpo diferente (SHA-256 do corpo; o corpo não é guardado) | idem |
| status_http | INTEGER 100–599 | Não | — | Reproduzir a resposta original | idem |
| resposta_json | TEXT | Não | — | Reproduzir a resposta. **Nunca** PII, tokens ou segredos — só IDs | idem |
| criado_em, expira_em | ISO | Sim | — | TTL | idem |

## Catálogo curricular (migration 0006; dados em `db/seeds/curriculo.sql`)
Dados de referência públicos (BNCC), **sem dado pessoal**, com chave natural (não ULID) para o seed ser determinístico e atividades referenciarem `habilidades.codigo`. Fonte de verdade: `data/curriculo/` (PED); o SQL é gerado por `node db/seeds/gerar-curriculo.mjs` — não editar à mão. Retenção de todas as colunas: permanente (reaplicar o seed corrige/remove o que mudou nos JSON).
Cuidado com os nomes: `etapas.id` **EF1/EF2** = Anos Iniciais/Finais; `anos_escolares.codigo` **EF1..EF9** = um ano específico (o mesmo vocabulário de `usuarios.ano_escolar` e `turmas.ano_escolar`, que são `CHECK`, não FK); a disciplina Educação Física tem id `EF`.

### etapas
| Campo | Tipo | Obrig. | Sensível? | Finalidade |
|---|---|---|---|---|
| id | TEXT: EF1, EF2, EM | Sim | — | Chave (`disciplinas.json`) |
| nome | TEXT ≤80 | Sim | — | Exibição |
| ordem | INTEGER único | Sim | — | Ordenar na UI |

### anos_escolares
| Campo | Tipo | Obrig. | Sensível? | Finalidade |
|---|---|---|---|---|
| codigo | TEXT: EF1..EF9, EM1..EM3 | Sim | — | Chave; ano de uso da habilidade e série do aluno/turma |
| etapa_id | TEXT → etapas (RESTRICT) | Sim | — | Etapa do ano (EF5 → EF1; EM1 → EM) |
| ano | INTEGER 1–9 | Sim | — | Número do ano/série (único por etapa) |
| rotulo | TEXT ≤30 | Sim | — | Exibição ("5º ano", "1ª série") |

### disciplinas
| Campo | Tipo | Obrig. | Sensível? | Finalidade |
|---|---|---|---|---|
| id | TEXT 2 letras maiúsculas (LP, MA, CI…) | Sim | — | Chave (`disciplinas.json`) |
| nome, area | TEXT ≤80 | Sim | — | Exibição e agrupamento (área do conhecimento) |
| prioridade | INTEGER 0/1 | Sim (padrão 0) | — | Disciplinas-piloto (LP e MA) |
| prefixo_bncc | TEXT 2 letras | Sim | — | Prefixo do código BNCC; não deduzir a disciplina dele |

### disciplina_etapas
| Campo | Tipo | Obrig. | Sensível? | Finalidade |
|---|---|---|---|---|
| disciplina_id | TEXT → disciplinas (CASCADE) | Sim | — | Disciplina |
| etapa_id | TEXT → etapas (RESTRICT) | Sim | — | Etapas em que a disciplina existe (PK = os dois) |

### habilidades
| Campo | Tipo | Obrig. | Sensível? | Finalidade |
|---|---|---|---|---|
| codigo | TEXT 6–12, `A-Z0-9` | Sim | — | Código oficial BNCC (ex.: `EF05MA03`), chave única; nunca inventar |
| disciplina_id | TEXT → disciplinas (RESTRICT) | Sim | — | Disciplina |
| ano_escolar | TEXT → anos_escolares (RESTRICT) | Sim | — | Ano/série de **uso** da habilidade |
| faixa_anos | TEXT `5` ou `3-5` | Não | — | Abrangência do código (LP: EF15 = 1–5, EF35 = 3–5) |
| descricao | TEXT ≤1000 | Sim | — | Texto da habilidade (paráfrase, ver `data/curriculo/README.md`) |
| objeto_conhecimento | TEXT ≤500 | Sim | — | Objeto de conhecimento |
| unidade_tematica | TEXT ≤100 | Não | — | Matemática |
| eixo | TEXT ≤100 | Não | — | Língua Portuguesa (prática de linguagem) |
| fonte | TEXT ≤20 | Sim | — | Id da fonte (`BNCC`, `PE`) |
| pe_ref_json | TEXT JSON válido | Não | — | Referência ao Currículo de PE `{documento, pagina, identificador, obs}`; hoje nulo em todas (PEN-019) |
| validar | INTEGER 0/1 | Sim (padrão 1) | — | 1 = dúvida de PED: **não usar em atividade publicada** (regra de aplicação, não do banco) |
| versao_dados | TEXT ≤20 | Sim | — | `meta.versao` do contrato de onde a linha veio |

## Banco legado (landing) — `leads`
Outro D1 (`APRENDEMAIS_LEADS`), congelado até a v1.0; migrations em `migrations/` (aplicar: `migrar.md` § Legado). Tratamento dos leads já captados (sem idade/consentimento parental): PEN-014.
| Campo | Tipo | Obrig. | Sensível? | Finalidade | Retenção |
|---|---|---|---|---|---|
| id | INTEGER autoincremento | Sim | — | Chave (exposta ao cliente como `leadId`; ver PEN-003) | até decisão de PEN-014 |
| nome, sobrenome | TEXT | Sim | Pessoal | Contato do interessado | idem |
| email | TEXT, **único sem diferenciar caixa** (`ux_leads_email` em `lower(email)`) | Sim | Pessoal | Contato e chave do upsert | idem |
| telefone | TEXT, **não único** | Sim | Pessoal | Contato. Não é chave: famílias/escolas compartilham número e o formato é livre | idem |
| perfil | TEXT | Sim | — | Segmentar o interesse (aluno, professor…) | idem |
| consentimento | INTEGER 0/1 | Sim | — | Registro do aceite do aviso de privacidade (sem versão do texto: limitação do legado) | idem |
| data_cadastro | TEXT (`CURRENT_TIMESTAMP`, UTC sem `Z`) | Sim | — | Quando entrou | idem |
| acessou_prototipo, data_acesso_prototipo | INTEGER 0/1, TEXT | Sim, Não | — | Medir conversão para o protótipo | idem |

## Retenção (premissas; itens ⚖ aguardam validação jurídica — PEN-011..PEN-015)
| Dado | Regra | Origem |
|---|---|---|
| Pré-cadastro `pendente_*` sem confirmação | `DELETE` do usuário após 7 dias (cascata leva vínculo, e-mail do responsável, consentimento e tokens) | RQ-05 ⚖ |
| Conta `ativa` inativa | Aviso aos 12 meses sem `ultimo_acesso_em`; anonimizar 30 dias depois | RQ-19 ⚖ |
| Pedido de exclusão | `suspensa_exclusao` → em ≤15 dias: anonimizar o usuário (`apagada`), apagar vínculos de responsável, matrículas e tokens, zerar `ip_hash` | RQ-14 |
| `consentimentos` de conta anonimizada | Mantidos sem PII (sem vínculo, sem `ip_hash`) como prova; prazo final a definir | art. 16 ⚖ |
| `tokens_acao`, `convites` | Apagar 7 dias depois de expirados/consumidos | minimização (RQ-11) |
| `idempotency_keys` | Apagar expirados (TTL 24 h) | ADR-001 §3 |
| `auditoria_acesso` | Mínimo 12 meses; premissa de purga aos 24 meses | RQ-31 ⚖ |
| Backups | ≤ 35 dias (RQ-20): conferir com DEV o período de recuperação do D1 | RQ-20 |

Estas rotinas **não existem ainda**: precisam de um job agendado (Cron Trigger do Worker) — pendência para BE/DEV.
