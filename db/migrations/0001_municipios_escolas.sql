-- 0001_municipios_escolas — geografia e escolas (sem dado pessoal).
-- Convenções (ADR-001 §3): id = ULID em TEXT gerado na API; datas = ISO-8601 UTC com 'Z' em TEXT;
-- colunas em snake_case. Migrations são imutáveis: mudança = nova migration.

CREATE TABLE municipios (
  id          TEXT PRIMARY KEY CHECK (length(id) = 26),
  codigo_ibge TEXT NOT NULL UNIQUE CHECK (codigo_ibge GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  nome        TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 100),
  uf          TEXT NOT NULL DEFAULT 'PE' CHECK (uf GLOB '[A-Z][A-Z]'),
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE escolas (
  id           TEXT PRIMARY KEY CHECK (length(id) = 26),
  municipio_id TEXT NOT NULL REFERENCES municipios (id) ON DELETE RESTRICT,
  nome         TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 150),
  codigo_inep  TEXT UNIQUE CHECK (codigo_inep IS NULL OR codigo_inep GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  ativa        INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (municipio_id, nome)
);

CREATE INDEX idx_escolas_municipio ON escolas (municipio_id);
