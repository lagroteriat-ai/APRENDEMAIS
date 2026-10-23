# Requisitos LGPD e menores — Aprende+ (v1.0 do contrato)

> **Não é aconselhamento jurídico.** Itens marcados ⚖ dependem da seção "Validar com jurídico". Dono: SEG. Consumidores: BE, DAD, FE, PED.
> Prioridade: **M** = obrigatório antes de qualquer dado de aluno em produção · **S** = até o fim da v0.x · **C** = desejável.

## 1. Situação atual (`functions/api/leads.js`)
- Coleta `nome`, `sobrenome`, `email`, `telefone`, `perfil` + `consentimento` (booleano). **Não há idade/data de nascimento nem consentimento parental**; o público inclui menores.
- Upsert por `email OR telefone` sobrescreve dados de outro titular (PEN-005). Sem página de privacidade confirmada nem fluxo de exclusão (PEN-009).
- Este documento vale para a **plataforma nova**; o fluxo de leads deve ser alinhado a RQ-01..RQ-08 antes de captar menores.

## 2. Base legal e menores (LGPD art. 14)
| ID | Requisito | Pri. |
|---|---|---|
| RQ-01 | Tratar dados de menores sempre no **melhor interesse** do menor; finalidade única e declarada: uso educacional da plataforma. | M |
| RQ-02 | **Menor = < 18 anos** (padrão conservador, cobre criança e adolescente). Idade declarada no cadastro (ano/mês de nascimento; não data completa). ⚖ | M |
| RQ-03 | Para < 18: conta só fica **ativa** após **consentimento específico e em destaque** de um responsável (art. 14 §1). Sem consentimento: nada além do mínimo para pedir a confirmação. | M |
| RQ-04 | Verificação do responsável: **e-mail do responsável com link de confirmação** (token de uso único, expira em 7 dias, registra data/versão do aviso). **Não exigir documentos.** Esforço razoável proporcional ao risco (art. 14 §5). ⚖ | M |
| RQ-05 | Se o responsável não confirmar em 7 dias, apagar o pré-cadastro do menor e o e-mail do responsável (sem reuso para marketing). ⚖ | M |
| RQ-06 | Aviso de privacidade **em linguagem simples**, com versão para o aluno (adequada à idade) e outra para o responsável (art. 14 §6). Versionado; cada consentimento guarda a versão aceita. | M |
| RQ-07 | Consentimento é **revogável** a qualquer momento, de forma tão fácil quanto concedido; revogar encerra o tratamento e dispara RQ-14. | M |
| RQ-08 | **Nada condicionado a dados extras**: participar de atividades/jogos não pode exigir mais dados que o necessário (art. 14 §4). Sem publicidade, sem perfilamento comportamental, sem venda/compartilhamento com terceiros para fins comerciais. | M |
| RQ-09 | Usuários ≥ 18 (professor, gestor, responsável): base legal por papel — consentimento ou execução de contrato/obrigação conforme o caso; registrar a base por finalidade (art. 37). ⚖ | S |
| RQ-10 | Alunos vinculados por **escola/professor** (uso institucional): definir se a escola é controladora e o Aprende+ operador, e se o consentimento parental é coletado pela escola. ⚖ | S |

## 3. Minimização — dados por papel
| Papel | Pode coletar | **NÃO coletar** |
|---|---|---|
| Aluno | apelido, ano/mês de nascimento, série/ano, turma, escola (vínculo), município, progresso/pontuação | CPF, RG, endereço, geolocalização, foto, nome completo (opcional ⚖), telefone, redes sociais, dados biométricos |
| Responsável | nome, e-mail, vínculo com o(s) aluno(s) | CPF/documentos, endereço, dados bancários |
| Professor | nome, e-mail institucional, escola, turmas | CPF, endereço, telefone pessoal, foto |
| Gestor | nome, e-mail institucional, escola/rede | CPF, endereço, telefone pessoal |
| Admin | e-mail, nome | demais |

| ID | Requisito | Pri. |
|---|---|---|
| RQ-11 | Cada campo novo no schema exige justificativa de finalidade no dicionário de dados (DAD); campo sem finalidade não entra. | M |
| RQ-12 | Proibido coletar CPF, endereço, localização (GPS/IP preciso) e dados sensíveis (art. 5º II: saúde, raça, religião etc.). Perfil pedagógico (ex.: dificuldades) é tratado como **dado de alto risco**: só agregado, sem rótulo permanente. ⚖ | M |
| RQ-13 | Sem login social e sem SDKs de terceiros de rastreamento/analytics com identificação individual nas telas do aluno. | M |

## 4. Direitos do titular e retenção (arts. 18–19)
| ID | Requisito | Pri. |
|---|---|---|
| RQ-14 | **Exclusão** em até **15 dias** da solicitação válida; para menores, solicitada pelo responsável (ou pelo próprio aluno, que notifica o responsável). Exclusão apaga PII e anonimiza pontuações/rankings. | M |
| RQ-15 | **Acesso e confirmação de tratamento**: resposta simplificada imediata (tela "Meus dados") e declaração completa em até **15 dias**. | S |
| RQ-16 | **Correção** de dados pelo próprio usuário/responsável na conta; sem exigir contato manual. | S |
| RQ-17 | **Portabilidade**: exportação em JSON/CSV legível dos dados do titular (progresso, respostas, pontuação), em até 15 dias. | S |
| RQ-18 | Canal único do titular/encarregado (e-mail dedicado + formulário), identificação do **encarregado (DPO)** publicada (art. 41). Pedido registrado com protocolo. ⚖ | M |
| RQ-19 | **Retenção**: conta ativa enquanto houver uso; inativa por **12 meses** → aviso e depois exclusão/anonimização em 30 dias. Pré-cadastros sem confirmação: 7 dias (RQ-05). Prazos finais ⚖. | S |
| RQ-20 | Backups com PII expiram em ≤ 35 dias; exclusão vale também para backups no ciclo seguinte. | S |

## 5. Ranking
| ID | Requisito | Pri. |
|---|---|---|
| RQ-21 | **Opt-in** explícito (padrão desligado); para < 18, exige o consentimento do responsável (RQ-03). Pode ser desligado a qualquer momento, removendo o aluno da lista. | M |
| RQ-22 | Exibir **somente apelido** (pseudônimo gerado/escolhido de lista segura), **sem nome real, sem foto, sem avatar com foto**. Apelido passa por filtro de palavrões e não pode conter dados pessoais. | M |
| RQ-23 | Visibilidade em escopos: **turma → escola → município**. Nunca ranking nacional/público aberto nem indexável por buscadores. Visível só a usuários autenticados do escopo. | M |
| RQ-24 | Mostrar posições relativas/faixas quando possível (ex.: "top 10", progresso próprio) para reduzir exposição e pressão; ranking sem exibir idade, série exata ou escola do aluno fora do escopo escola. | S |
| RQ-25 | Em ranking por município, só publicar quando houver **k ≥ 10** participantes (evita reidentificação em grupos pequenos). ⚖ | S |

## 6. Mídia (GIF/meme)
| ID | Requisito | Pri. |
|---|---|---|
| RQ-26 | Só mídia de **fonte licenciada** (acervo próprio, domínio público, CC0/CC-BY com atribuição, ou provedor com termos que permitam embed). Registrar origem, licença e autor por item. Proibido hotlink de conteúdo sem licença. ⚖ | M |
| RQ-27 | **Moderação prévia** (curadoria pelo time/professor) antes de exibir ao aluno; sem upload livre de mídia por alunos. | M |
| RQ-28 | Proibido: imagens de pessoas reais identificáveis (especialmente crianças), conteúdo sexual, violento, discriminatório, político-partidário, marcas/publicidade. | M |
| RQ-29 | Botão "denunciar mídia" nas telas e remoção em até 24 h úteis após denúncia procedente; log da decisão. | S |

## 7. Logs, auditoria e incidentes
| ID | Requisito | Pri. |
|---|---|---|
| RQ-30 | Logs de aplicação **sem PII**: nunca registrar nome, e-mail, telefone, tokens, corpo de requisições. Usar ID interno opaco; IP truncado ou hash com sal, retenção ≤ 90 dias. | M |
| RQ-31 | **Trilha de auditoria** (quem, quando, ação, alvo por ID) para: acesso a dados de aluno por professor/gestor/admin, exportação, exclusão, mudança de papel, alteração de consentimento. Retenção ≥ 12 meses. | M |
| RQ-32 | Respostas de erro não vazam detalhes internos (`error.message`); sem PII em URLs/query strings. | M |
| RQ-33 | **Plano de incidentes**: detecção, contenção, avaliação de risco, comunicação à ANPD e aos titulares (art. 48) em **prazo razoável — adotar meta de 3 dias úteis** após ciência; registro interno de todo incidente. ⚖ | M |
| RQ-34 | Acesso de admin a dados de alunos por **menor privilégio**, com motivo registrado; token admin nunca em código/repositório. | M |

## 8. Papéis e matriz de permissões inicial
Legenda: **L** ler · **E** editar · **X** excluir · **—** sem acesso · *próprio* = só o próprio registro · *vínculo* = apenas alunos/turmas/escolas vinculados.

| Dado / ação | Aluno | Responsável | Professor | Gestor | Admin |
|---|---|---|---|---|---|
| Perfil do aluno (apelido, série) | L/E *próprio* | L/E *vínculo* | L *turmas* | L *escola* | L (auditado) |
| Consentimento / revogação | — | L/E *vínculo* | — | L *escola* (status) | L (auditado) |
| Progresso e pontuação | L *próprio* | L *vínculo* | L *turmas* | L agregado *escola* | L agregado |
| Ranking (apelido) | L *escopo* | L *vínculo* | L *turmas* | L *escola* | L |
| Criar/editar atividades | — | — | E *próprias* | L | E (curadoria) |
| Mídia (curadoria) | — | — | propor | aprovar *escola* | aprovar/remover |
| Exportar dados | L *próprio* | L *vínculo* | — | agregado | auditado |
| Excluir conta/dados | pedir | X *vínculo* | — | — | X (a pedido, auditado) |
| Gerenciar usuários e papéis | — | — | — | E *escola* (prof.) | E |
| Logs de auditoria | — | — | — | L *escola* | L |

| ID | Requisito | Pri. |
|---|---|---|
| RQ-35 | Autorização **no servidor** em toda rota (papel + vínculo); a UI esconde, mas não é a barreira. Negar por padrão. | M |
| RQ-36 | Professor/gestor só veem dados individuais de alunos **vinculados**; vínculo por convite/aceite, com remoção automática ao sair da turma/escola. | M |

## 9. Validar com jurídico
1. Idade-limite de consentimento parental (< 18 vs. < 12 criança / 12–17 adolescente) e hipóteses legais aplicáveis a adolescentes (RQ-02, RQ-09).
2. Suficiência de "e-mail do responsável + confirmação" como esforço razoável de verificação (RQ-04) e prazo de 7 dias (RQ-05).
3. Papel da escola/rede (controladora × operadora) e quem coleta o consentimento parental no uso institucional (RQ-10); necessidade de contrato/DPA.
4. Aplicabilidade e exigências do **ECA Digital** (Lei 15.211/2025) e regulamentação da ANPD para serviços digitais voltados a menores.
5. Nome completo do aluno: pode ser coletado em contexto escolar ou só apelido? (tabela §3).
6. Prazos de retenção e de resposta a direitos (RQ-14..19) e retenção de logs/auditoria (RQ-30, RQ-31).
7. Prazo e forma de comunicação de incidentes à ANPD/titulares (RQ-33) e necessidade de RIPD/DPIA (relatório de impacto) para dados de menores.
8. Indicação e publicação do encarregado/DPO (RQ-18) e texto do aviso de privacidade (RQ-06).
9. Regras de licenciamento de mídia e de provedores de GIF de terceiros (RQ-26); k-anonimato mínimo do ranking (RQ-25).
10. Tratamento dos leads já captados na landing atual (sem idade/consentimento parental): reconsentir, anonimizar ou excluir.
