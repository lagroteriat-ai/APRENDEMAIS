// Gera db/seeds/curriculo.sql a partir de data/curriculo/*.json (fonte de verdade: PED).
//   node db/seeds/gerar-curriculo.mjs          grava o SQL
//   node db/seeds/gerar-curriculo.mjs --check  falha (exit 1) se o SQL versionado estiver desatualizado (CI)
// O SQL é idempotente (upsert + remoção do que saiu dos JSON): pode ser reaplicado a cada atualização do currículo.
// Sem dependências; Node >= 18.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dirDados = join(raiz, 'data', 'curriculo');
const saida = join(raiz, 'db', 'seeds', 'curriculo.sql');
const lerJson = (arq) => JSON.parse(readFileSync(join(dirDados, arq), 'utf8'));

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const erros = [];
const falha = (msg) => erros.push(msg);

const cur = lerJson('disciplinas.json');
const etapas = cur.etapas;
const etapaIds = new Set(etapas.map((e) => e.id));

// ano escolar: EF1/EF2 + ano -> 'EF5'; EM + ano -> 'EM1'
const anos = etapas.flatMap((e, i) =>
  e.anos.map((a) => ({ codigo: `${e.id === 'EM' ? 'EM' : 'EF'}${a.id}`, etapa: e.id, ano: a.id, rotulo: a.rotulo })));
const anoCodigos = new Set(anos.map((a) => a.codigo));
if (anoCodigos.size !== anos.length) falha('anos_escolares duplicados em disciplinas.json');

const disciplinas = cur.disciplinas;
const discIds = new Set(disciplinas.map((d) => d.id));
if (discIds.size !== disciplinas.length) falha('ids de disciplina duplicados');
for (const d of disciplinas) for (const e of d.etapas) if (!etapaIds.has(e)) falha(`disciplina ${d.id}: etapa desconhecida ${e}`);

const habilidades = [];
const vistos = new Set();
for (const d of disciplinas.filter((x) => x.arquivo_habilidades)) {
  if (!existsSync(join(dirDados, d.arquivo_habilidades))) { falha(`arquivo ausente: ${d.arquivo_habilidades}`); continue; }
  const arq = lerJson(d.arquivo_habilidades);
  const etapaMeta = arq.meta.etapa;
  if (arq.meta.disciplina !== d.id) falha(`${d.arquivo_habilidades}: meta.disciplina=${arq.meta.disciplina} != ${d.id}`);
  for (const h of arq.habilidades) {
    if (vistos.has(h.codigo)) falha(`código duplicado: ${h.codigo}`);
    vistos.add(h.codigo);
    if (h.disciplina !== d.id) falha(`${h.codigo}: disciplina ${h.disciplina} fora de ${d.arquivo_habilidades}`);
    if (!/^[A-Z0-9]{6,12}$/.test(h.codigo)) falha(`${h.codigo}: formato de código inválido`);
    if (typeof h.validar !== 'boolean') falha(`${h.codigo}: validar deve ser booleano`);
    const ano = `${etapaMeta === 'EM' ? 'EM' : 'EF'}${h.ano}`;
    if (!anoCodigos.has(ano)) falha(`${h.codigo}: ano ${h.ano} inexistente na etapa ${etapaMeta}`);
    habilidades.push({ ...h, ano_escolar: ano, versao: arq.meta.versao });
  }
}
if (erros.length) {
  console.error('Currículo inválido:\n- ' + erros.join('\n- '));
  process.exit(1);
}

const L = [];
L.push(`-- GERADO por db/seeds/gerar-curriculo.mjs a partir de data/curriculo/ (contrato v${cur.versao}). NÃO edite à mão.`);
L.push('-- Idempotente: pode ser reaplicado (wrangler d1 execute DB --local|--remote --file db/seeds/curriculo.sql).');
L.push('-- Requer a migration 0006_catalogo_curricular. Linhas que saíram dos JSON são removidas (FKs impedem apagar o que já é usado).');
L.push('');
etapas.forEach((e, i) => L.push(
  `INSERT INTO etapas (id, nome, ordem) VALUES (${q(e.id)}, ${q(e.nome)}, ${i + 1}) ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, ordem = excluded.ordem;`));
for (const a of anos) L.push(
  `INSERT INTO anos_escolares (codigo, etapa_id, ano, rotulo) VALUES (${q(a.codigo)}, ${q(a.etapa)}, ${a.ano}, ${q(a.rotulo)}) ON CONFLICT (codigo) DO UPDATE SET etapa_id = excluded.etapa_id, ano = excluded.ano, rotulo = excluded.rotulo;`);
L.push('');
for (const d of disciplinas) L.push(
  `INSERT INTO disciplinas (id, nome, area, prioridade, prefixo_bncc) VALUES (${q(d.id)}, ${q(d.nome)}, ${q(d.area)}, ${d.prioridade ? 1 : 0}, ${q(d.prefixo_bncc)}) ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, area = excluded.area, prioridade = excluded.prioridade, prefixo_bncc = excluded.prefixo_bncc;`);
L.push('DELETE FROM disciplina_etapas;');
for (const d of disciplinas) for (const e of d.etapas) L.push(
  `INSERT INTO disciplina_etapas (disciplina_id, etapa_id) VALUES (${q(d.id)}, ${q(e)});`);
L.push('');
for (const h of habilidades) L.push(
  `INSERT INTO habilidades (codigo, disciplina_id, ano_escolar, faixa_anos, descricao, objeto_conhecimento, unidade_tematica, eixo, fonte, pe_ref_json, validar, versao_dados) ` +
  `VALUES (${q(h.codigo)}, ${q(h.disciplina)}, ${q(h.ano_escolar)}, ${q(h.faixa_anos)}, ${q(h.descricao)}, ${q(h.objeto_conhecimento)}, ${q(h.unidade_tematica)}, ${q(h.eixo)}, ${q(h.fonte)}, ` +
  `${h.pe_ref ? q(JSON.stringify(h.pe_ref)) : 'NULL'}, ${h.validar ? 1 : 0}, ${q(h.versao)}) ` +
  `ON CONFLICT (codigo) DO UPDATE SET disciplina_id = excluded.disciplina_id, ano_escolar = excluded.ano_escolar, faixa_anos = excluded.faixa_anos, descricao = excluded.descricao, objeto_conhecimento = excluded.objeto_conhecimento, unidade_tematica = excluded.unidade_tematica, eixo = excluded.eixo, fonte = excluded.fonte, pe_ref_json = excluded.pe_ref_json, validar = excluded.validar, versao_dados = excluded.versao_dados;`);
L.push('');
L.push('-- remove o que saiu do currículo (ordem: habilidades antes de disciplinas, por causa das FKs)');
L.push(`DELETE FROM habilidades WHERE codigo NOT IN (${habilidades.map((h) => q(h.codigo)).join(', ')});`);
L.push(`DELETE FROM disciplinas WHERE id NOT IN (${disciplinas.map((d) => q(d.id)).join(', ')});`);
L.push('');

const sql = L.join('\n');
if (process.argv.includes('--check')) {
  // tolera CRLF (checkout com autocrlf no Windows)
  const atual = existsSync(saida) ? readFileSync(saida, 'utf8').replace(/\r\n/g, '\n') : '';
  if (atual !== sql) { console.error('db/seeds/curriculo.sql está desatualizado: rode node db/seeds/gerar-curriculo.mjs'); process.exit(1); }
  console.log('curriculo.sql em dia');
} else {
  writeFileSync(saida, sql, 'utf8');
  console.log(`gravado ${saida}: ${etapas.length} etapas, ${anos.length} anos, ${disciplinas.length} disciplinas, ${habilidades.length} habilidades`);
}
