-- 0006_catalogo_curricular — catálogo MÍNIMO da taxonomia BNCC/PE: etapas, anos, disciplinas e habilidades.
-- Só a estrutura; os dados vêm de data/curriculo/ por db/seeds/curriculo.sql (re-executável, gerado por
-- db/seeds/gerar-curriculo.mjs). Atividades, objetos de conhecimento próprios e agregações: V02-DAD-01.
--
-- Chaves NATURAIS (não ULID): são dados de referência públicos, sem risco de enumeração, e o contrato de PED
-- (COMUNICACAO) fixa o código BNCC como chave única — atividades vão referenciar `habilidades.codigo` (ex.: EF05MA03).
-- Sem dado pessoal.

-- Etapas do currículo (ids de data/curriculo/disciplinas.json). ATENÇÃO: 'EF1' = Anos Iniciais (1º–5º) e
-- 'EF2' = Anos Finais (6º–9º); NÃO confundir com anos_escolares.codigo 'EF1'..'EF9' (um ano específico).
CREATE TABLE etapas (
  id    TEXT PRIMARY KEY CHECK (id IN ('EF1', 'EF2', 'EM')),
  nome  TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
  ordem INTEGER NOT NULL UNIQUE
);

-- Mesmo vocabulário de usuarios.ano_escolar e turmas.ano_escolar (EF1..EF9 = 1º..9º ano; EM1..EM3 = 1ª..3ª série).
CREATE TABLE anos_escolares (
  codigo   TEXT PRIMARY KEY CHECK (codigo IN
             ('EF1', 'EF2', 'EF3', 'EF4', 'EF5', 'EF6', 'EF7', 'EF8', 'EF9', 'EM1', 'EM2', 'EM3')),
  etapa_id TEXT NOT NULL REFERENCES etapas (id) ON DELETE RESTRICT,
  ano      INTEGER NOT NULL CHECK (ano BETWEEN 1 AND 9),
  rotulo   TEXT NOT NULL CHECK (length(rotulo) BETWEEN 1 AND 30),
  UNIQUE (etapa_id, ano)
);

CREATE TABLE disciplinas (
  id           TEXT PRIMARY KEY CHECK (id GLOB '[A-Z][A-Z]'),
  nome         TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 80),
  area         TEXT NOT NULL CHECK (length(area) BETWEEN 1 AND 80),
  prioridade   INTEGER NOT NULL DEFAULT 0 CHECK (prioridade IN (0, 1)),
  -- prefixo do código BNCC; não deduzir a disciplina do prefixo (Educação Física usa 'EF')
  prefixo_bncc TEXT NOT NULL CHECK (prefixo_bncc GLOB '[A-Z][A-Z]')
);

CREATE TABLE disciplina_etapas (
  disciplina_id TEXT NOT NULL REFERENCES disciplinas (id) ON DELETE CASCADE,
  etapa_id      TEXT NOT NULL REFERENCES etapas (id) ON DELETE RESTRICT,
  PRIMARY KEY (disciplina_id, etapa_id)
) WITHOUT ROWID;

CREATE TABLE habilidades (
  -- código oficial da BNCC em maiúsculas (ex.: EF05MA03); nunca inventar código próprio
  codigo              TEXT PRIMARY KEY CHECK (length(codigo) BETWEEN 6 AND 12 AND codigo NOT GLOB '*[^A-Z0-9]*'),
  disciplina_id       TEXT NOT NULL REFERENCES disciplinas (id) ON DELETE RESTRICT,
  -- ano/série de USO; a abrangência do código (ex.: EF35 = 3º ao 5º) fica em faixa_anos
  ano_escolar         TEXT NOT NULL REFERENCES anos_escolares (codigo) ON DELETE RESTRICT,
  faixa_anos          TEXT CHECK (faixa_anos IS NULL OR faixa_anos GLOB '[1-9]' OR faixa_anos GLOB '[1-9]-[1-9]'),
  descricao           TEXT NOT NULL CHECK (length(descricao) BETWEEN 1 AND 1000),
  objeto_conhecimento TEXT NOT NULL CHECK (length(objeto_conhecimento) BETWEEN 1 AND 500),
  unidade_tematica    TEXT CHECK (unidade_tematica IS NULL OR length(unidade_tematica) <= 100),
  eixo                TEXT CHECK (eixo IS NULL OR length(eixo) <= 100),
  -- id de fonte do contrato de PED ('BNCC', 'PE'); texto livre curto para não travar novas fontes
  fonte               TEXT NOT NULL CHECK (length(fonte) BETWEEN 1 AND 20),
  -- referência ao Currículo de PE: JSON {documento, pagina, identificador, obs} ou nulo (nada conferido ainda)
  pe_ref_json         TEXT CHECK (pe_ref_json IS NULL OR json_valid(pe_ref_json)),
  -- 1 = dúvida de PED: NÃO usar em atividade publicada até um humano conferir (regra de aplicação)
  validar             INTEGER NOT NULL DEFAULT 1 CHECK (validar IN (0, 1)),
  -- meta.versao do contrato data/curriculo/ de onde a linha veio
  versao_dados        TEXT NOT NULL CHECK (length(versao_dados) BETWEEN 1 AND 20)
);

CREATE INDEX idx_habilidades_disciplina_ano ON habilidades (disciplina_id, ano_escolar);
CREATE INDEX idx_habilidades_ano ON habilidades (ano_escolar);
CREATE INDEX idx_anos_escolares_etapa ON anos_escolares (etapa_id);
CREATE INDEX idx_disciplina_etapas_etapa ON disciplina_etapas (etapa_id);
