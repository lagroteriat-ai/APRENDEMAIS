-- 0001_leads_inicial — baseline da tabela `leads` (D1 LEGADO da landing, banco APRENDEMAIS_LEADS; não é o D1 da plataforma).
-- Idêntica a schema.sql / 0001_initial/schema.sql originais. O wrangler só lê arquivos *.sql direto nesta pasta
-- (a subpasta 0001_initial/ é ignorada), por isso este baseline existe: serve para subir um banco novo do zero
-- e é um no-op em bancos criados à mão com schema.sql (todo comando é IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  perfil TEXT NOT NULL,
  consentimento INTEGER NOT NULL DEFAULT 0,
  data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acessou_prototipo INTEGER NOT NULL DEFAULT 0,
  data_acesso_prototipo TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_data ON leads(data_cadastro);
