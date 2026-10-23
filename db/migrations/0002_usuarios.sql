-- 0002_usuarios — contas e papéis. Mínimo de dados pessoais (RQ-11, RQ-12; docs/seguranca/lgpd-requisitos.md §3).
-- Sessões NÃO ficam no D1: ADR-001 §4 escolheu sessão opaca em KV (por isso não existe tabela `sessoes`).
-- A revogação imediata usa `sessao_versao` (a sessão em KV guarda a versão; divergiu = inválida).

CREATE TABLE usuarios (
  id                     TEXT PRIMARY KEY CHECK (length(id) = 26),
  -- papel principal; papéis adicionais ficam em usuario_papeis (ADR-001 §4: um usuário pode ter mais de um)
  papel                  TEXT NOT NULL CHECK (papel IN ('aluno', 'responsavel', 'professor', 'gestor', 'admin')),
  -- estados da conta: docs/ux/fluxos.md §3. Acesso só com 'ativa'.
  status                 TEXT NOT NULL CHECK (status IN
                           ('pendente_responsavel', 'pendente_email', 'ativa', 'suspensa_exclusao', 'apagada')),
  ativo                  INTEGER GENERATED ALWAYS AS (status = 'ativa') VIRTUAL,
  -- aluno: gerado pelo servidor e usado como login (DU-01); único sem diferenciar maiúsculas (índice abaixo)
  apelido                TEXT CHECK (apelido IS NULL OR (length(apelido) BETWEEN 3 AND 32 AND apelido NOT GLOB '*[^A-Za-z0-9]*')),
  -- nunca preenchido para aluno (§3 do RQ; nome completo do aluno depende de validação jurídica)
  nome                   TEXT CHECK (nome IS NULL OR length(nome) BETWEEN 1 AND 120),
  -- sempre em minúsculas e sem espaços nas pontas; aluno < 18 não tem e-mail (credencial = apelido + senha)
  email                  TEXT UNIQUE CHECK (email IS NULL OR
                           (email = lower(trim(email)) AND length(email) <= 254 AND instr(email, '@') > 1)),
  -- 'pbkdf2-sha256$<iterações>$<salt b64>$<hash b64>' (ADR-001 §4); nunca a senha
  credencial_hash        TEXT,
  -- só ano e mês (RQ-02): 'AAAA-MM'. A idade é calculada na aplicação; ambíguo na virada dos 18 = menor.
  nascimento_ym          TEXT CHECK (nascimento_ym IS NULL OR
                           (nascimento_ym GLOB '[12][0-9][0-9][0-9]-[01][0-9]' AND substr(nascimento_ym, 6, 2) BETWEEN '01' AND '12')),
  ano_escolar            TEXT CHECK (ano_escolar IS NULL OR ano_escolar IN
                           ('EF1', 'EF2', 'EF3', 'EF4', 'EF5', 'EF6', 'EF7', 'EF8', 'EF9', 'EM1', 'EM2', 'EM3')),
  sessao_versao          INTEGER NOT NULL DEFAULT 1 CHECK (sessao_versao >= 1),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ultimo_acesso_em       TEXT,
  exclusao_solicitada_em TEXT,

  -- aluno ativo/pendente: apelido, nascimento e ano escolar obrigatórios; nunca nome
  CHECK (papel <> 'aluno' OR status = 'apagada'
         OR (apelido IS NOT NULL AND nascimento_ym IS NOT NULL AND ano_escolar IS NOT NULL)),
  CHECK (papel <> 'aluno' OR nome IS NULL),
  -- demais papéis: nome e e-mail obrigatórios (RQ §3)
  CHECK (papel = 'aluno' OR status = 'apagada' OR (nome IS NOT NULL AND email IS NOT NULL)),
  CHECK (status <> 'pendente_responsavel' OR papel = 'aluno'),
  CHECK (status = 'apagada' OR credencial_hash IS NOT NULL),
  CHECK (status <> 'suspensa_exclusao' OR exclusao_solicitada_em IS NOT NULL),
  -- 'apagada' = conta anonimizada (mantém só o id, para pontuações/rankings anonimizados, RQ-14)
  CHECK (status <> 'apagada' OR (apelido IS NULL AND nome IS NULL AND email IS NULL AND credencial_hash IS NULL
                                 AND nascimento_ym IS NULL AND ano_escolar IS NULL))
);

-- login do aluno: WHERE lower(apelido) = lower(?)  (NULLs não colidem em UNIQUE)
CREATE UNIQUE INDEX ux_usuarios_apelido ON usuarios (lower(apelido));
-- rotinas de retenção: pré-cadastros expirados (RQ-05), inativos (RQ-19), exclusões pendentes (RQ-14)
CREATE INDEX idx_usuarios_status_criado ON usuarios (status, criado_em);
CREATE INDEX idx_usuarios_status_acesso ON usuarios (status, ultimo_acesso_em);
CREATE INDEX idx_usuarios_exclusao ON usuarios (exclusao_solicitada_em) WHERE status = 'suspensa_exclusao';

-- Papéis ADICIONAIS (além de usuarios.papel). Papel efetivo = usuarios.papel ∪ usuario_papeis.
-- 'admin' só entra por seed/CLI (ADR-001 §4). Mudança de papel => incrementar usuarios.sessao_versao.
CREATE TABLE usuario_papeis (
  usuario_id    TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  papel         TEXT NOT NULL CHECK (papel IN ('aluno', 'responsavel', 'professor', 'gestor', 'admin')),
  concedido_por TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  concedido_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (usuario_id, papel)
) WITHOUT ROWID;
