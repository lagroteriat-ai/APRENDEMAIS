-- 0005_auditoria_idempotencia — trilha de auditoria (RQ-31) e chaves de idempotência (ADR-001 §3).

-- Quem, quando, ação e alvo por ID. SEM PII: nunca gravar nome, e-mail, IP ou corpo de requisição (RQ-30).
-- Append-only: UPDATE é bloqueado (exceto ator_id, que o D1 zera ao apagar o usuário); retenção >= 12 meses.
CREATE TABLE auditoria_acesso (
  id         TEXT PRIMARY KEY CHECK (length(id) = 26),
  -- nulo para ações do sistema (jobs) ou se o ator foi apagado
  ator_id    TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  ator_papel TEXT NOT NULL CHECK (ator_papel IN ('aluno', 'responsavel', 'professor', 'gestor', 'admin', 'sistema')),
  -- catálogo de ações em docs/dados/dicionario.md (validado em shared-types, não por CHECK)
  acao       TEXT NOT NULL CHECK (length(acao) BETWEEN 3 AND 60),
  alvo_tipo  TEXT NOT NULL CHECK (length(alvo_tipo) BETWEEN 1 AND 40),
  -- id opaco do alvo; sem FK de propósito: a trilha sobrevive à exclusão do alvo
  alvo_id    TEXT CHECK (alvo_id IS NULL OR length(alvo_id) <= 64),
  -- obrigatório na prática para admin (RQ-34); texto livre SEM dados pessoais
  motivo     TEXT CHECK (motivo IS NULL OR length(motivo) <= 300),
  request_id TEXT CHECK (request_id IS NULL OR length(request_id) <= 64),
  criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_auditoria_alvo ON auditoria_acesso (alvo_tipo, alvo_id, criado_em);
CREATE INDEX idx_auditoria_ator ON auditoria_acesso (ator_id, criado_em) WHERE ator_id IS NOT NULL;
CREATE INDEX idx_auditoria_criado ON auditoria_acesso (criado_em);

CREATE TRIGGER trg_auditoria_sem_update
BEFORE UPDATE OF ator_papel, acao, alvo_tipo, alvo_id, motivo, request_id, criado_em ON auditoria_acesso
BEGIN
  SELECT RAISE(ABORT, 'auditoria_acesso é append-only');
END;

-- Idempotency-Key (UUID) em POSTs que criam/consomem; TTL 24 h. Mesma chave + corpo diferente => 409 IDEMPOTENCY_CONFLICT.
-- `escopo` = método + rota (+ id do usuário nas rotas autenticadas). A resposta guardada NÃO pode conter PII nem segredos.
CREATE TABLE idempotency_keys (
  escopo        TEXT NOT NULL CHECK (length(escopo) BETWEEN 1 AND 120),
  chave         TEXT NOT NULL CHECK (length(chave) BETWEEN 16 AND 64),
  corpo_hash    TEXT NOT NULL CHECK (length(corpo_hash) = 64),
  status_http   INTEGER CHECK (status_http IS NULL OR status_http BETWEEN 100 AND 599),
  resposta_json TEXT,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em     TEXT NOT NULL,
  PRIMARY KEY (escopo, chave)
) WITHOUT ROWID;

CREATE INDEX idx_idempotency_expira ON idempotency_keys (expira_em);
