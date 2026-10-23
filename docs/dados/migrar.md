# Como aplicar as migrations do D1 da plataforma

Dono: DAD · Migrations: `db/migrations/NNNN_nome.sql` · Dicionário: `docs/dados/dicionario.md`.
Este banco é **separado** do D1 da landing (`APRENDEMAIS_LEADS`; ADR-001 §5). O legado tem suas próprias migrations em `migrations/` (raiz) — ver § Legado; as regras de imutabilidade valem para os dois.

## Regras
- Arquivos numerados em sequência (`0001`, `0002`…), nome em `snake_case` pt-BR, direto em `db/migrations/` (sem subpastas — o wrangler só lê `*.sql` do diretório).
- **Imutáveis** depois de publicadas (commit na `main` ou aplicadas em staging/prod). Mudança = nova migration; nunca edite uma já aplicada.
- Uma migration = uma mudança coesa; sem `BEGIN`/`COMMIT` dentro do arquivo; sem dados pessoais reais em seeds (nem fixtures).
- Reconstruir tabela (SQLite não altera `CHECK`): criar nova, copiar, `DROP`, renomear e recriar índices/triggers, com `PRAGMA defer_foreign_keys = on;` no início. O D1 aplica chaves estrangeiras.
- Antes de abrir PR: apague o estado local e aplique **do zero** (abaixo).

## Configuração do binding (responsabilidade do DEV-01)
O wrangler do Worker da API (`apps/api/wrangler.toml`, ainda inexistente) deve apontar para estas migrations. Caminho relativo ao arquivo de configuração:
```toml
[[d1_databases]]
binding = "DB"
database_name = "aprendemais-plataforma"        # nome por ambiente: definir no DEV-01
database_id = "<id do D1 do ambiente>"          # wrangler d1 create aprendemais-plataforma
migrations_dir = "../../db/migrations"
```
Não reutilize o `wrangler.toml` da raiz: ele é da landing (`migrations_dir = "migrations"`, D1 de leads).

## Local (sem conta Cloudflare)
```powershell
cd apps/api
npx wrangler d1 migrations apply DB --local      # aplica o que falta, na ordem
npx wrangler d1 migrations list DB --local       # deve dizer "No migrations to apply"
npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```
Recomeçar do zero: apague `apps/api/.wrangler/state/v3/d1` (ou use `--persist-to <pasta>` e apague a pasta) e rode `apply` de novo.

## Remoto (staging/produção)
```powershell
cd apps/api
npx wrangler d1 create aprendemais-plataforma                      # uma vez por ambiente; copie o database_id
npx wrangler d1 migrations apply DB --remote --env staging         # staging primeiro
npx wrangler d1 migrations apply DB --remote --env production      # só depois de validar em staging
```
- Produção só após staging verde; faça `npx wrangler d1 time-travel info DB --env production` antes e anote o bookmark para voltar atrás em caso de erro.
- No CI (DEV-01): `apply --local` do zero em todo PR; `--remote` só no deploy.
- Admin inicial: criado por CLI/seed fora destas migrations (ADR-001 §4); nenhum usuário é inserido por migration.

## Seeds (dados de referência)
Migrations criam estrutura; **dados do catálogo curricular não são migration** (mudam a cada revisão de PED). Ficam em `db/seeds/`:
```powershell
node db/seeds/gerar-curriculo.mjs            # regenera db/seeds/curriculo.sql a partir de data/curriculo/*.json
node db/seeds/gerar-curriculo.mjs --check    # CI: falha se o SQL versionado estiver desatualizado
cd apps/api
npx wrangler d1 execute DB --local --file ../../db/seeds/curriculo.sql
npx wrangler d1 execute DB --remote --env staging --file ../../db/seeds/curriculo.sql   # idem production, após staging
```
- Rodar **depois** das migrations (precisa da 0006). Idempotente: reaplicar atualiza o que mudou e remove o que saiu dos JSON. Se uma habilidade removida já estiver em uso por outra tabela, a FK faz o seed falhar (de propósito) em vez de apagar em silêncio.
- Fluxo de PED: editar `data/curriculo/` → `node db/seeds/gerar-curriculo.mjs` → commitar JSON + SQL juntos → aplicar o seed nos ambientes. O gerador recusa JSON inconsistente (código duplicado, disciplina/ano inexistente, `validar` não booleano).
- Habilidade com `validar = 1` existe no catálogo, mas **não pode entrar em atividade publicada** (regra do BE/PED; o banco não impede).
- Sem dado pessoal em seeds, nunca (vale também para fixtures de teste).

## Legado (landing — tabela `leads`)
Banco separado (`APRENDEMAIS_LEADS`, binding `DB` do `wrangler.toml` da raiz, `migrations_dir = "migrations"`). Só o wrangler lê `.sql` **direto** em `migrations/`; a subpasta antiga `migrations/0001_initial/` é ignorada (provavelmente por isso o D1 de leads foi criado à mão, com `schema.sql`). Mantida só como histórico — não alterar.
- `0001_leads_inicial.sql`: baseline idempotente (`IF NOT EXISTS`); no-op em banco criado à mão, cria a tabela em banco novo.
- `0002_leads_email_unico.sql` (PEN-005): normaliza e-mail (`trim`+`lower`); por e-mail, **fica o registro mais antigo (menor id)**, que mantém seus dados e recebe o resumo do grupo (maior `consentimento`, maior `acessou_prototipo`, data de acesso mais antiga); apaga o resto; troca `idx_leads_email` por `UNIQUE (lower(email))`.
- **Telefone não ganha UNIQUE:** não identifica uma pessoa (pai/mãe com vários filhos, telefone da escola), o campo é texto livre com máscara, e a UNIQUE faria o 2º cadastro da mesma família falhar. A falha de PEN-005 era *usar* telefone como chave do upsert: isso acaba (abaixo). Segue o índice comum `idx_leads_telefone`.
- **Destrutiva e sem volta.** Antes de produção: (1) `npx wrangler d1 time-travel info DB --env production` e anotar o bookmark; (2) conferir o impacto:
  ```sql
  SELECT lower(trim(email)) AS email, count(*) AS n FROM leads GROUP BY 1 HAVING n > 1;
  ```
  (3) aplicar em staging, depois `npx wrangler d1 migrations apply DB --remote --env production` na raiz do repositório.
- **Impacto no upsert (`functions/api/leads.js`, ação do BE — PEN-038):** a consulta atual (`WHERE lower(email) = ? OR telefone = ?` + UPDATE/INSERT) deve virar uma instrução só, com o e-mail como única chave:
  ```sql
  INSERT INTO leads (nome, sobrenome, email, telefone, perfil, consentimento)
  VALUES (?, ?, ?, ?, ?, 1)
  ON CONFLICT (lower(email)) DO UPDATE SET nome = excluded.nome, sobrenome = excluded.sobrenome,
    telefone = excluded.telefone, perfil = excluded.perfil, consentimento = 1
  RETURNING id
  ```
  Efeitos: sem corrida entre dois POSTs do mesmo e-mail; telefone repetido cria lead novo em vez de sobrescrever outro; `leadId` vem de `RETURNING id`. Não publicar o código novo antes da migration (o `ON CONFLICT` exige o índice). `leadId` de duplicatas apagadas deixa de existir.
- Risco que continua: o upsert por e-mail ainda deixa quem souber o e-mail de alguém sobrescrever nome/telefone daquele lead e receber o `accessToken`; mitigação é decisão do BE/SEG (por exemplo, não atualizar dados em conflito), fora desta tarefa.

## Dica de Windows
`--persist-to` (ou o diretório `.wrangler/state`) com caminho muito longo faz o miniflare falhar com `internal error; reference = …` em qualquer comando D1 local. Use uma pasta curta (`--persist-to .\s`).

## Estado da validação (S1-DAD-02)
- Banco **novo** a partir de `migrations/` (com a subpasta legada presente): 0001 e 0002 aplicam. Banco **existente** criado com o `schema.sql` original + 3 leads (2 duplicados por caixa/espaço): `migrations apply` conclui e restam 2 leads, índices `idx_leads_data`, `idx_leads_telefone`, `ux_leads_email`.
- Regra de dedup (script `node:sqlite`, 14 verificações): menor id mantido, e-mail normalizado, flags consolidados, telefone repetido segue permitido, e-mail com outra caixa recusado, `ON CONFLICT (lower(email))` atualiza o mesmo id e não toca em outros leads, consulta `lower(email) = ?` usa o índice.
- `db/migrations` 0001–0006 do zero no wrangler + seed duas vezes (152 comandos cada; 3 etapas, 12 anos, 9 disciplinas, 22 vínculos disciplina–etapa, 103 habilidades, 81 com `validar`); 20 verificações do catálogo (constraints, FKs, idempotência, remoção, bloqueio por FK) e regressão dos 59 casos de S1-DAD-01.
- Os mesmos recursos não testados no D1 remoto da S1-DAD-01 valem aqui, mais `json_valid()` e `ON CONFLICT` com expressão.

## Estado da validação (S1-DAD-01)
- `wrangler d1 migrations apply DB --local` (wrangler 4.152.0): 0001–0005 aplicadas do zero sem erro; segunda execução: "No migrations to apply".
- 59 casos de constraints executados num script descartável (`node:sqlite` sobre os mesmos arquivos): casos válidos aceitos e inválidos recusados (formato do apelido e e-mail, unicidade, consentimento vigente único, matrícula vigente única, cascatas de exclusão, auditoria append-only, FKs íntegras).
- **Não testado no D1 remoto** (sem conta/`database_id`): usa coluna gerada, índice por expressão (`lower(apelido)`), índices parciais, `WITHOUT ROWID` e um trigger. São recursos do SQLite que o D1 deve aceitar, mas isso não foi verificado; conferir no primeiro `--remote --env staging`.

## Consultas que dependem de forma específica para usar o índice
- Login do aluno: `WHERE lower(apelido) = lower(?)` (usa `ux_usuarios_apelido`).
- Consentimento vigente: `WHERE usuario_id = ? AND finalidade = ? AND status IN ('pendente','concedido')` (`ux_consentimentos_vigente`).
- Matrícula vigente: `WHERE turma_id = ? AND aluno_id = ? AND status IN ('pendente','ativa')` (`ux_matriculas_vigente`).
- Consumir link de uso único (atômico): `UPDATE tokens_acao SET consumido_em = ? WHERE token_hash = ? AND consumido_em IS NULL AND expira_em > ?` e conferir `meta.changes = 1` (0 = inválido, usado ou vencido).
- Expurgo de pré-cadastro: `WHERE status IN ('pendente_responsavel','pendente_email') AND criado_em < ?` (`idx_usuarios_status_criado`).
