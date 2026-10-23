# data/curriculo — taxonomia curricular (BNCC / Currículo de Pernambuco)

Contrato **v0.1.0** (S1-PED-01). Consumidores: DAD (carga no D1/dicionário), BE (API de conteúdo), PED (atividades).

## Arquivos
| Arquivo | Conteúdo |
|---|---|
| `disciplinas.json` | Etapas (EF1 1º–5º, EF2 6º–9º, EM 1ª–3ª série) e disciplinas, com `prioridade` e `cobertura_atual` |
| `habilidades-matematica.json` | Matemática, 5º ano EF: EF05MA01–25 (25 habilidades) |
| `habilidades-lingua-portuguesa.json` | Língua Portuguesa, 5º ano EF: EF05LP01–28, EF35LP01–31, EF15LP01–19 (78) |

Disciplinas fora do piloto têm `arquivo_habilidades: null`; os arquivos futuros seguem `habilidades-<nome-sem-acento>.json`.

## Formato de cada habilidade
```json
{ "codigo": "EF05MA03", "descricao": "…", "ano": 5, "objeto_conhecimento": "…",
  "disciplina": "MA", "fonte": "BNCC", "pe_ref": null, "validar": false }
```
- `codigo`: código oficial da BNCC, **chave única** (maiúsculas). Nunca criar código próprio.
- `disciplina`: `id` de `disciplinas.json` (não deduzir do prefixo do código; Educação Física usa prefixo `EF`).
- `ano`: ano/série de uso (inteiro). Em LP, `faixa_anos` informa a abrangência do código (`EF15`→"1-5", `EF35`→"3-5", `EF05`→"5").
- `fonte`: id de fonte (tabela abaixo). `pe_ref`: referência ao Currículo de Pernambuco (ver abaixo), `null` se não conferida.
- `validar`: `true` = dúvida; **não usar em atividade publicada** até um humano conferir e trocar para `false`.
- Extras: `unidade_tematica` (MA), `eixo` (LP: prática de linguagem), `faixa_anos` (LP).
- Cada arquivo tem `meta` (escopo, versão, `status_conferencia`) e `habilidades[]`.

## Estado de conferência (importante)
Não foi possível baixar o PDF oficial neste ambiente. Os **códigos e o tema** de cada habilidade foram conferidos por duas vias (conhecimento do autor + página secundária de listagem). Os campos `descricao` são **paráfrase/reprodução de memória, não citação literal**, e `objeto_conhecimento`/`eixo` não foram conferidos contra o texto oficial:
- Matemática: 22 de 25 com `validar: false` (descrição e objeto coerentes com a BNCC; ainda sujeitas à conferência literal). `validar: true` em EF05MA04, EF05MA24, EF05MA25 (objeto de conhecimento incerto).
- Língua Portuguesa: **todas** `validar: true`.
Antes de gerar atividades publicáveis, rodar a conferência abaixo.

## Fontes
| id | Fonte | Observação |
|---|---|---|
| `BNCC` | Base Nacional Comum Curricular, MEC (2017/2018) — https://basenacionalcomum.mec.gov.br/ | Homologada pela Portaria MEC nº 1.570/2017 (conferir número/data na fonte); instituída pela Resolução CNE/CP nº 2/2017 |
| `PE` | Currículo de Pernambuco — Ensino Fundamental (SEE-PE/UNDIME-PE, 2019) | Portal: https://www.educacao.pe.gov.br/ — **link exato do PDF do EF ainda não confirmado** (PEN-019) |

## Licença / uso (resposta a R1 do BACKLOG)
- **BNCC**: documento oficial do MEC, de acesso público e gratuito. Os textos das habilidades e códigos são parte de ato normativo (Lei 9.610/98, art. 8º, IV exclui atos oficiais da proteção autoral), então **usar códigos e descrições de habilidades como referência é considerado seguro, com atribuição à fonte**. Material *sobre* a BNCC produzido por terceiros (livros didáticos, planos de aula, sites de professores, Currículo Paulista etc.) tem direitos próprios: **não copiar**. Esta avaliação não é parecer jurídico; confirmar na PEN-019.
- **Currículo de Pernambuco**: licença de reuso **não identificada**. Até confirmação com a SEE-PE, usar apenas a referência (`pe_ref`: documento/página/identificador), **sem copiar trechos** do texto.
- Atividades e mídias novas são conteúdo próprio do Aprende+; GIFs/memes seguem o R2 (só mídia própria ou licenciada).

## Mapeamento com o Currículo de Pernambuco (`pe_ref`)
O Currículo de PE se organiza sobre a BNCC. Regra: a **chave de ligação é o código BNCC**; o PE pode acrescentar objetos de conhecimento/expectativas regionais.
- Formato de `pe_ref` quando conferido: `{ "documento": "Currículo de Pernambuco EF 2019", "pagina": 123, "identificador": "…", "obs": "…" }`.
- Se o PE não tiver correspondente claro, manter `pe_ref: null` e anotar em `obs`. **Não inventar códigos** PE.
- Todas as entradas atuais estão com `pe_ref: null` (nada conferido).

## Convenções
- UTF-8, JSON válido, 2 espaços, português do Brasil. Códigos em maiúsculas.
- Alterar o formato = nova versão do contrato (`meta.versao`) + `AVISO` em `COMUNICACAO.md`.
- Não incluir atividades aqui (ficam em outro diretório, tarefa PED futura).

## Como validar
1. Abrir a BNCC oficial (link acima), localizar o código e comparar `descricao`, `ano` e `objeto_conhecimento`.
2. Corrigir o JSON; se confere literalmente, `validar: false`; se não achar o código, **remover** (não manter).
3. Conferir o `pe_ref` no Currículo de PE e preencher só com o que for visível no documento.
4. Checagem automática (PowerShell, exemplo):
   ```powershell
   $d = Get-Content habilidades-matematica.json -Raw | ConvertFrom-Json
   $d.habilidades.codigo | Group-Object | Where-Object Count -gt 1   # códigos duplicados
   $d.habilidades | Where-Object { $_.codigo -notmatch '^EF\d{2}[A-Z]{2}\d{2}$' }   # formato
   ```
