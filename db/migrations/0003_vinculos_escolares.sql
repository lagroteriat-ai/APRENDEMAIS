-- 0003_vinculos_escolares — quem pertence a qual escola/turma (base do RQ-36: vínculo checado no servidor).
-- Vínculo removido = linha apagada (a trilha fica em auditoria_acesso). Modelo de atribuição de atividades: V03-DAD-01.

-- Professor/gestor numa escola.
CREATE TABLE escola_membros (
  escola_id  TEXT NOT NULL REFERENCES escolas (id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  papel      TEXT NOT NULL CHECK (papel IN ('professor', 'gestor')),
  criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (escola_id, usuario_id, papel)
) WITHOUT ROWID;

CREATE INDEX idx_escola_membros_usuario ON escola_membros (usuario_id);

-- Convite de professor/gestor (72 h, uso único, preso a e-mail + escola; DU-04 / COMUNICACAO). Só o hash do token.
CREATE TABLE convites (
  id          TEXT PRIMARY KEY CHECK (length(id) = 26),
  escola_id   TEXT NOT NULL REFERENCES escolas (id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (email = lower(trim(email)) AND length(email) <= 254 AND instr(email, '@') > 1),
  papel       TEXT NOT NULL CHECK (papel IN ('professor', 'gestor')),
  token_hash  TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  criado_por  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em   TEXT NOT NULL,
  aceito_em   TEXT,
  aceito_por  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  CHECK (aceito_por IS NULL OR aceito_em IS NOT NULL)
);

CREATE INDEX idx_convites_escola ON convites (escola_id);
CREATE INDEX idx_convites_email ON convites (email);
CREATE INDEX idx_convites_expira ON convites (expira_em);

CREATE TABLE turmas (
  id           TEXT PRIMARY KEY CHECK (length(id) = 26),
  escola_id    TEXT NOT NULL REFERENCES escolas (id) ON DELETE RESTRICT,
  nome         TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
  ano_escolar  TEXT NOT NULL CHECK (ano_escolar IN
                 ('EF1', 'EF2', 'EF3', 'EF4', 'EF5', 'EF6', 'EF7', 'EF8', 'EF9', 'EM1', 'EM2', 'EM3')),
  ano_letivo   INTEGER NOT NULL CHECK (ano_letivo BETWEEN 2020 AND 2100),
  arquivada_em TEXT,
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (escola_id, ano_letivo, nome)
);

-- Professores responsáveis por uma turma (professor deve ser membro da escola: regra de aplicação).
CREATE TABLE turma_professores (
  turma_id     TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  professor_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (turma_id, professor_id)
) WITHOUT ROWID;

CREATE INDEX idx_turma_professores_prof ON turma_professores (professor_id);

-- Vínculo aluno–turma por convite/aceite (RQ-36): 'pendente' (convidado) -> 'ativa' (aceite) -> 'encerrada'.
CREATE TABLE matriculas (
  id           TEXT PRIMARY KEY CHECK (length(id) = 26),
  turma_id     TEXT NOT NULL REFERENCES turmas (id) ON DELETE RESTRICT,
  aluno_id     TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativa', 'encerrada')),
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  aceita_em    TEXT,
  encerrada_em TEXT,
  CHECK (status <> 'ativa' OR aceita_em IS NOT NULL),
  CHECK (status <> 'encerrada' OR encerrada_em IS NOT NULL)
);

-- no máximo um vínculo vigente (pendente ou ativo) por aluno e turma
CREATE UNIQUE INDEX ux_matriculas_vigente ON matriculas (turma_id, aluno_id) WHERE status IN ('pendente', 'ativa');
CREATE INDEX idx_matriculas_aluno ON matriculas (aluno_id);
CREATE INDEX idx_matriculas_turma ON matriculas (turma_id, status);
CREATE INDEX idx_turmas_escola ON turmas (escola_id, ano_letivo);
