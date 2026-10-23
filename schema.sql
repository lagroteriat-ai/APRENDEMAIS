-- Estado ATUAL da tabela `leads` (D1 legado da landing) para criar um banco novo à mão.
-- Equivale a migrations/0001_leads_inicial.sql + 0002_leads_email_unico.sql. Para bancos existentes use as migrations.
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_email ON leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_data ON leads(data_cadastro);
