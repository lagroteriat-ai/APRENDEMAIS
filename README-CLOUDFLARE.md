# Aprende+ — Landing Page + Leads no Cloudflare

Este projeto foi preparado para **Cloudflare Pages + GitHub + Cloudflare D1**.

## 1. Estrutura

- `index.html` — landing page.
- `style.css` — visual.
- `script.js` — cadastro e envio do formulário.
- `functions/api/leads.js` — salva/atualiza leads no D1.
- `functions/api/prototype-access.js` — registra o acesso ao protótipo.
- `functions/admin/leads.js` — API protegida para o painel.
- `admin.html`, `admin.css`, `admin.js` — painel administrativo.
- `schema.sql` — estrutura do banco.
- `wrangler.toml` — configuração do D1 para Cloudflare.

## 2. Criar o D1

No Cloudflare Dashboard:

**Workers & Pages → D1 SQL databases → Create database**

Nome sugerido:

`APRENDEMAIS_LEADS`

Copie o **Database ID**.

## 3. Colocar o ID no projeto

Abra `wrangler.toml` e troque:

`COLOQUE_O_ID_DO_SEU_D1_AQUI`

pelo Database ID real.

## 4. Criar a tabela

No D1, abra o SQL Console e execute o conteúdo de `schema.sql`.

## 5. Configurar o binding no Pages

No projeto do Cloudflare Pages:

**Settings → Functions → Bindings → Add binding → D1 database**

- Variable name: `DB`
- D1 database: `APRENDEMAIS_LEADS`

Salve e faça um novo deploy.

## 6. Criar o token do painel

No Pages:

**Settings → Environment variables**

Crie uma variável:

`ADMIN_TOKEN`

Use um valor forte e secreto. Não coloque esse valor dentro do GitHub, HTML, CSS ou JavaScript.

Depois faça novo deploy.

## 7. Testar

Landing page:

`https://SEU-DOMINIO/`

Painel:

`https://SEU-DOMINIO/admin.html`

No painel, informe o valor de `ADMIN_TOKEN`.

## 8. Fluxo do cadastro

1. Visitante preenche o formulário.
2. `POST /api/leads` valida e grava no D1.
3. Se o e-mail ou telefone já existir, o cadastro é atualizado em vez de duplicado.
4. Depois do cadastro, o visitante é enviado ao protótipo.
5. `POST /api/prototype-access` registra que o lead acessou o protótipo.
6. O painel consulta os leads por `GET /api/admin/leads`.

## 9. Privacidade

Como o Aprende+ é voltado à educação e pode envolver estudantes menores de idade, publique um aviso de privacidade adequado ao seu projeto e colete somente os dados necessários. O formulário desta versão exige aceite explícito antes de salvar o contato.

Para produção, considere proteger o painel com **Cloudflare Access** além do token administrativo.
