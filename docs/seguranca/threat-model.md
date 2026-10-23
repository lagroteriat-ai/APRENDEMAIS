# Threat model — plataforma Aprende+ (v1.0)

> Dono: SEG · Base: ADR-001/ADR-002, `lgpd-requisitos.md` (RQ-xx), DU-01..07 (COMUNICACAO). Consumidores: BE, DEV, FE, DAD, QA.
> **Documento interno**: não publicar como estático (PEN-016). Revisar a cada mudança de contrato de auth ou novo componente.
> Escopo: nova plataforma (SPA + API Worker + D1/KV/R2). A landing legada só aparece em F5/F6.

## 1. Ativos
| ID | Ativo | Sensibilidade | Onde vive |
|---|---|---|---|
| A1 | Dados de menores: apelido, nascimento `AAAA-MM`, turma/escola, progresso, respostas | Alta (RQ-01, RQ-12) | D1 |
| A2 | E-mail do responsável e registros de consentimento (versão do aviso, data) | Alta | D1 |
| A3 | Credenciais: hash PBKDF2 de senha, tokens de consentimento/gerenciar/recuperação/convite (hash) | Crítica | D1 |
| A4 | Sessões: hash do token → `{userId, expiresAt}` | Crítica | KV + cookie `__Host-sid` |
| A5 | Vínculos e papéis (aluno↔turma↔escola, responsável↔aluno, papéis) | Alta: base de toda autorização | D1 |
| A6 | Ranking/pontuação | Média (integridade, exposição de apelido) | D1 (+ cache KV) |
| A7 | Mídia curada e exportações temporárias | Média/alta (exportação contém A1) | R2 privado |
| A8 | Segredos de deploy (`wrangler secret`, tokens CI) e trilha de auditoria | Crítica | Cloudflare/GitHub, D1 |

## 2. Fronteiras de confiança
- **F1** Navegador (aluno/responsável/professor/gestor; dispositivo possivelmente compartilhado na escola) ↔ Worker web/API. Tudo do cliente é não confiável.
- **F2** Worker API ↔ D1/KV/R2 (bindings; só `apps/api` toca, camada `policy` nega por padrão).
- **F3** API ↔ serviços externos: provedor de e-mail (links de consentimento/recuperação), Turnstile.
- **F4** Admin (seed/CLI, painel) ↔ API: maior privilégio, ações auditadas (RQ-34).
- **F5** CI/CD (GitHub Actions, `wrangler deploy`) ↔ conta Cloudflare.
- **F6** Landing legada (`/api/leads`, `ADMIN_TOKEN`) — mesmo domínio até a v1.0, D1/segredos separados.

## 3. Ameaças STRIDE por componente
| ID | Comp. | STRIDE | Ameaça | Mitigação | Resp. |
|---|---|---|---|---|---|
| T01 | SPA | S/I | XSS rouba ações da sessão (cookie é HttpOnly, mas o script age em nome do usuário) | React sem `dangerouslySetInnerHTML`; CSP estrita (`script-src 'self'`, sem inline), `frame-ancestors 'none'` | FE/DEV |
| T02 | SPA | I | Dados de menor em `localStorage`, URL ou cache em PC compartilhado | Nada de PII em storage/URL; `Cache-Control: no-store` em `/api/v1`; logout limpa estado | FE |
| T03 | SPA | T | Dependência npm comprometida no bundle | Lockfile, `pnpm audit` no CI, sem CDN de terceiros, SRI se houver | DEV |
| T04 | API | S | Sessão sequestrada/fixada | Token 256 bits renovado no login e na troca de papel; `__Host-` Secure/HttpOnly/SameSite=Lax | BE |
| T05 | API | T | CSRF em POST/PUT/DELETE | `Origin` na allowlist + `Content-Type: application/json` obrigatório; sem GET que altere estado | BE |
| T06 | API | E | IDOR/BOLA: aluno lê outro aluno; professor lê turma alheia; responsável lê não vinculado | `policy` único com papel **e vínculo** em toda rota; ULID não substitui autorização; fora do vínculo = 404 | BE |
| T07 | API | E | Mass assignment (cliente envia `papel`, `escolaId`, `pontos`, `consentido`) | Zod `.strict()` por rota; campos de servidor nunca vêm do corpo | BE |
| T08 | API | R | Ação sensível sem rastro (exportar, excluir, trocar papel) | Auditoria RQ-31 com ator, alvo (ID), motivo, `requestId`; tabela só-inserção | BE/DAD |
| T09 | API | I | Vazamento por erro, log ou enumeração | Erros RQ-32; logs sem PII (RQ-30); mesma resposta e tempo em login/recuperação | BE |
| T10 | API | D | Abuso de CPU (PBKDF2 600k) e de e-mail (reenvios) | Rate Limiting + Turnstile antes do hash; limites de reenvio (DU) | BE/DEV |
| T11 | D1 | T/I | SQL injection; dump por credencial de CI vazada | Só `prepare().bind()`; token CI com escopo mínimo; segredos fora do repo | BE/DEV |
| T12 | D1 | T | Duplicação/corrida (consumo duplo de token, pontos duplicados) | UNIQUE + transação/`batch`; `Idempotency-Key`; uso único marcado atomicamente | DAD/BE |
| T13 | KV | S/R | Revogação atrasada (~60 s) após logout/exclusão/troca de papel | Status, papel e vínculo lidos do D1 por requisição (ADR §4); KV só identidade | BE |
| T14 | KV | T | Cache de ranking/currículo envenenado ou servido a escopo errado | Chave inclui escopo (turma/escola/município); só o Worker grava | BE |
| T15 | R2 | I | Exportação com dados de menor acessível por URL adivinhável ou eterna | Bucket privado; download via API com autorização; URL com expiração ≤15 min; objeto apagado ≤24 h | BE/DEV |
| T16 | R2 | T | Mídia ofensiva ou sem licença | Só curadoria (RQ-26/27); alunos não fazem upload; `Content-Type` fixo e `nosniff` | BE/PED |
| T17 | Admin | E/S | Conta admin comprometida = acesso a todos os menores | Admin por seed/CLI; 2º fator obrigatório (ver PEN-025); sessão 8 h; motivo + auditoria; alerta em exportação em massa | BE/DEV |
| T18 | Admin | E | Painel legado `ADMIN_TOKEN` estático de longa duração | Rotacionar ao migrar (S1-BE-05); nunca reaproveitar na nova plataforma | DEV |
| T19 | CI/CD | T/E | Deploy publica árvore inteira (docs, threat model) ou PR malicioso usa segredos | `[assets]` só da pasta de build (PEN-016); segredos só em `main`/ambientes protegidos | DEV |
| T20 | E-mail | S | Phishing imitando e-mails de consentimento; link vazado por encaminhamento | SPF/DKIM/DMARC; links de uso único, só hash no banco, TTL curto | DEV/BE |

## 4. Abusos específicos
| ID | Abuso | Cenário | Mitigação | Resp. |
|---|---|---|---|---|
| AB1 | Enumeração de usuários | Login/recuperação/cadastro respondem diferente para apelido/e-mail existente; **apelido = login (DU-01) e é exibido no ranking** → metade da credencial é pública | Mesma mensagem e tempo; limite por IP/conta; decisão em PEN-023 (separar login de nome exibido) | BE/SEG |
| AB2 | Força bruta / credential stuffing | Senhas de crianças fracas; PIN de turma curto | Turnstile após 3 falhas, limite por conta e IP, lista de senhas comuns, bloqueio progressivo; PIN só com professor presente (PEN-024) | BE/DEV |
| AB3 | Token de consentimento forjado | Menor clica no próprio link ou usa e-mail próprio como "responsável"; adivinha/reaproveita token | Token ≥128 bits aleatório, hash no D1, uso único, 7 d; aluno logado não confirma; e-mail do responsável ≠ e-mail do aluno; risco residual aceito (RQ-04 ⚖) | BE |
| AB4 | IDOR entre alunos/turmas | Trocar ULID na URL; professor removido continua lendo turma; responsável desvinculado | T06 + vínculo revalidado por requisição + 404; testes com 2 tenants | BE/QA |
| AB5 | Ranking fraudado | Repetir resposta, enviar pontuação pelo cliente, contas falsas na turma, script automatizado | Pontos calculados só no servidor a partir da resposta; idempotência por tentativa; limite de tentativas/h; só alunos vinculados contam | BE/DAD |
| AB6 | Exposição via ranking | Apelido + escola + posição reidentifica criança | RQ-21..25: opt-in, apelido gerado, escopo autenticado, k ≥ 10 | BE/FE |
| AB7 | Abuso de "Sortear outro"/reenvio | Varredura de apelidos ou spam ao responsável | ≤10 sorteios/cadastro, reenvio ≤3/dia (DU) | BE |

## 5. Requisitos de segurança verificáveis (QA)
| ID | Requisito (critério de aceite) | Comp. | Resp. |
|---|---|---|---|
| SR-01 | Toda rota `/api/v1` sem cookie válido → 401 `UNAUTHENTICATED`, exceto as listadas como públicas no OpenAPI | API | BE |
| SR-02 | Usuário A acessando recurso de B fora do vínculo (aluno, turma, escola, responsável) → 404 `NOT_FOUND`; matriz §8 do RQ testada por papel | API | BE |
| SR-03 | Corpo com campo extra (`papel`, `pontos`, `escolaId`...) → 400 `VALIDATION_ERROR`, nada gravado | API | BE |
| SR-04 | POST/PUT/DELETE com `Origin` fora da allowlist ou `Content-Type` ≠ JSON → 403, sem efeito | API | BE |
| SR-05 | Cookie de sessão: `__Host-sid`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`; ≥256 bits; novo valor após login | API | BE |
| SR-06 | Logout, troca de senha/papel, revogação de consentimento ou exclusão → requisição seguinte com a sessão antiga dá 401 (sem esperar KV) | API | BE |
| SR-07 | TTL: aluno/responsável 7 d ocioso/30 d absoluto; professor/gestor 12 h/7 d; admin 8 h absoluto | API | BE |
| SR-08 | Login e recuperação com conta inexistente × existente: mesmo status, corpo e `message`; diferença de tempo mediana < 50 ms em 100 amostras | API | BE |
| SR-09 | 3 falhas de login por conta **ou** IP em 15 min → Turnstile obrigatório; 10 falhas → 429 `RATE_LIMITED` por 15 min | API | BE/DEV |
| SR-10 | Senha: 8–128 caracteres, rejeita lista comum e igual ao apelido; armazenada só como PBKDF2-SHA256 ≥600 mil iterações com sal único | API | BE |
| SR-11 | Tokens de link (consentimento, gerenciar, recuperação, convite): ≥128 bits; só hash no D1; 2º uso → erro; vencido (7 d/30 d/30 min/72 h) → erro | API | BE/DAD |
| SR-12 | Conta < 18 (ou ambígua na virada) sem consentimento confirmado não acessa atividades/ranking; e-mail de responsável igual ao do aluno é recusado | API | BE |
| SR-13 | Reenvio de consentimento > 3/dia → 429; "Sortear outro" > 10 por cadastro → 429 | API | BE |
| SR-14 | Pontuação enviada pelo cliente é ignorada; mesma `Idempotency-Key` duas vezes → um único registro de pontos | API/D1 | BE/DAD |
| SR-15 | Ranking: sem opt-in o aluno não aparece; só apelido; não acessível sem sessão do escopo; município com < 10 participantes não é exibido | API | BE |
| SR-16 | Respostas de erro sem stack, SQL ou `error.message` interno; logs de teste não contêm e-mail, senha, token nem corpo da requisição | API | BE |
| SR-17 | Ações sensíveis (exportar, excluir, trocar papel, acesso admin a aluno, consentimento) geram linha de auditoria com ator, alvo, ação, data, `requestId` | API/D1 | BE/DAD |
| SR-18 | Cabeçalhos em todas as respostas web: CSP sem `unsafe-inline`/`unsafe-eval`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, HSTS | SPA | DEV/FE |
| SR-19 | `/api/v1` responde `Cache-Control: no-store`; SPA não grava PII em `localStorage`/`sessionStorage`/URL (inspeção E2E) | SPA/API | FE/BE |
| SR-20 | Objetos R2 inacessíveis sem passar pela API; URL de exportação expira em ≤15 min e objeto some em ≤24 h | R2 | BE/DEV |
| SR-21 | Deploy publica só a pasta de build: `GET /docs/seguranca/threat-model.md`, `/DECISOES.md`, `/wrangler.toml` → 404 em staging e prod | Deploy | DEV |
| SR-22 | Admin: rota exige papel `admin` + 2º fator (após PEN-025); ação sem motivo → 400; não existe cadastro público de admin/professor | Admin | BE |
| SR-23 | CI falha com dependência de severidade alta/crítica (`pnpm audit`) ou segredo detectado no diff | CI | DEV |
| SR-24 | SQL: busca por varredura não encontra concatenação de strings em consultas (só `prepare().bind()`) | D1 | BE/QA |

## 6. Riscos residuais e premissas
- Verificação parental por e-mail não prova parentesco (aceito por RQ-04 ⚖; PEN-011).
- KV eventualmente consistente: mitigado por leitura de status no D1 (SR-06); custo de leitura por requisição aceito.
- Dispositivos compartilhados na escola: dependem de logout e TTL; considerar "sair ao fechar" para alunos (UX).
