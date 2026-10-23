-- 0002_leads_email_unico — PEN-005: um lead por e-mail (D1 LEGADO da landing).
-- DESTRUTIVA: apaga linhas duplicadas e não tem volta. Antes de aplicar em produção, guarde um bookmark do
-- Time Travel e rode a consulta de conferência de docs/dados/migrar.md (§ Legado).
--
-- Regra de dedup: dentro de cada e-mail (sem diferenciar caixa/espaços) fica o registro MAIS ANTIGO (menor id),
-- que mantém seus próprios dados (nome, telefone, perfil). Ele recebe o resumo do grupo para não perder fatos:
-- consentimento = o maior, acessou_prototipo = o maior, data_acesso_prototipo = a mais antiga entre os acessos.
-- Telefone NÃO ganha UNIQUE (docs/dados/migrar.md § Legado): índice comum idx_leads_telefone permanece.

-- 1. normaliza e-mails gravados antes do código passar a aplicar trim + lower
UPDATE leads SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- 2. consolida os sinalizadores no registro mantido de cada grupo duplicado
UPDATE leads
SET consentimento         = (SELECT max(d.consentimento) FROM leads d WHERE d.email = leads.email),
    acessou_prototipo     = (SELECT max(d.acessou_prototipo) FROM leads d WHERE d.email = leads.email),
    data_acesso_prototipo = COALESCE(
      (SELECT min(d.data_acesso_prototipo) FROM leads d WHERE d.email = leads.email AND d.acessou_prototipo = 1),
      data_acesso_prototipo)
WHERE id IN (SELECT min(id) FROM leads GROUP BY email HAVING count(*) > 1);

-- 3. remove as duplicatas
DELETE FROM leads WHERE id NOT IN (SELECT min(id) FROM leads GROUP BY email);

-- 4. unicidade sem diferenciar maiúsculas; substitui o índice comum de e-mail (redundante e não usado por lower(email) = ?)
DROP INDEX IF EXISTS idx_leads_email;
CREATE UNIQUE INDEX ux_leads_email ON leads (lower(email));
