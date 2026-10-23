-- 0004_responsaveis_consentimentos — consentimento parental (LGPD art. 14; RQ-03..RQ-08, RQ-21).
-- Responsável não tem conta no Sprint 1 (DU-02): age por link de uso único enviado ao e-mail.
-- Todo token de link é guardado só como hash SHA-256 (hex, 64 caracteres); o valor sai apenas no e-mail.

-- Quem responde por um aluno. Apagado junto com o aluno (RQ-05 / RQ-14): o e-mail do responsável não sobrevive.
CREATE TABLE responsaveis_vinculos (
  id                     TEXT PRIMARY KEY CHECK (length(id) = 26),
  aluno_id               TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  -- reservado para quando o responsável tiver conta (versão futura)
  responsavel_usuario_id TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  responsavel_email      TEXT NOT NULL CHECK (responsavel_email = lower(trim(responsavel_email))
                                              AND length(responsavel_email) <= 254 AND instr(responsavel_email, '@') > 1),
  -- informado pelo responsável na tela de autorização (T06); nulo até lá
  responsavel_nome       TEXT CHECK (responsavel_nome IS NULL OR length(responsavel_nome) BETWEEN 1 AND 120),
  confirmado_em          TEXT,
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (aluno_id, responsavel_email)
);

CREATE INDEX idx_vinculos_email ON responsaveis_vinculos (responsavel_email);
CREATE INDEX idx_vinculos_responsavel ON responsaveis_vinculos (responsavel_usuario_id) WHERE responsavel_usuario_id IS NOT NULL;

-- Registro de cada consentimento (uma linha por concessão; reconceder após revogar = nova linha).
-- `usuario_id` é o titular dos dados (o aluno). Evidência: versão do texto, datas e IP hasheado.
CREATE TABLE consentimentos (
  id            TEXT PRIMARY KEY CHECK (length(id) = 26),
  usuario_id    TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  vinculo_id    TEXT REFERENCES responsaveis_vinculos (id) ON DELETE SET NULL,
  finalidade    TEXT NOT NULL CHECK (finalidade IN ('uso_plataforma', 'ranking')),
  concedido_por TEXT NOT NULL CHECK (concedido_por IN ('responsavel', 'titular')),
  -- versão do aviso apresentado, ex.: 'aviso-responsavel@1.0' (RQ-06)
  versao_texto  TEXT NOT NULL CHECK (length(versao_texto) BETWEEN 1 AND 40),
  status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concedido', 'recusado', 'revogado', 'expirado')),
  solicitado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em     TEXT,
  decidido_em   TEXT,
  revogado_em   TEXT,
  -- HMAC-SHA256 (hex) do IP de quem decidiu, com segredo do servidor; nunca o IP (RQ-12, RQ-30)
  ip_hash       TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  CHECK (status NOT IN ('concedido', 'recusado', 'revogado') OR decidido_em IS NOT NULL),
  CHECK (status <> 'revogado' OR revogado_em IS NOT NULL),
  CHECK (revogado_em IS NULL OR status = 'revogado'),
  CHECK (status <> 'pendente' OR expira_em IS NOT NULL)
);

-- no máximo um consentimento vigente (pendente ou concedido) por aluno e finalidade
CREATE UNIQUE INDEX ux_consentimentos_vigente ON consentimentos (usuario_id, finalidade) WHERE status IN ('pendente', 'concedido');
CREATE INDEX idx_consentimentos_vinculo ON consentimentos (vinculo_id) WHERE vinculo_id IS NOT NULL;
CREATE INDEX idx_consentimentos_pendentes ON consentimentos (expira_em) WHERE status = 'pendente';

-- Links de uso único por e-mail. `consumido_em` marca uso OU substituição por um link mais novo.
-- Limite de reenvio (≤3/dia, COMUNICACAO) = contar linhas de (usuario_id, tipo) nas últimas 24 h.
CREATE TABLE tokens_acao (
  id               TEXT PRIMARY KEY CHECK (length(id) = 26),
  usuario_id       TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  consentimento_id TEXT REFERENCES consentimentos (id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('consentimento', 'gerenciar_consentimento', 'recuperacao_senha', 'confirmacao_email')),
  token_hash       TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  criado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em        TEXT NOT NULL,
  consumido_em     TEXT,
  -- tokens de consentimento apontam o consentimento; os demais não
  CHECK ((tipo IN ('consentimento', 'gerenciar_consentimento')) = (consentimento_id IS NOT NULL))
);

CREATE INDEX idx_tokens_usuario_tipo ON tokens_acao (usuario_id, tipo, criado_em);
CREATE INDEX idx_tokens_consentimento ON tokens_acao (consentimento_id) WHERE consentimento_id IS NOT NULL;
CREATE INDEX idx_tokens_expira ON tokens_acao (expira_em);
