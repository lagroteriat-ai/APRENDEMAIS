// Gera src/styles/tokens.css (CSS variables --am-*) a partir de docs/ux/tokens.json.
// Uso: `pnpm tokens` (grava) · `pnpm tokens:check` (falha se o arquivo estiver desatualizado).
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TOKENS_JSON = new URL('../../../docs/ux/tokens.json', import.meta.url);
const TOKENS_CSS = new URL('../src/styles/tokens.css', import.meta.url);

// Chaves de documentação do JSON (não viram variável).
const META = new Set([
  '$meta', 'origem', 'uso', 'novo', 'nota', 'regra', 'regras', 'descricao', 'legado', 'abordagem',
  'layout', 'fonte', 'pares', 'proibidos', 'meta', 'campo', 'campoErro', 'rotulo', 'densidade', 'icones',
]);
// Grupos que viram variáveis. `contraste` e `breakpoints` são só documentação/consulta
// (media queries não aceitam var()); `etapa` vira seletores [data-etapa].
const GRUPOS = ['color', 'typography', 'space', 'radius', 'shadow', 'border', 'size', 'motion', 'zIndex'];

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const num = (n) => String(Number(n.toFixed(4)));
const px = (n) => (n === 0 ? '0' : `${num(n)}px`);
const rem = (n) => (n === 0 ? '0' : `${num(n / 16)}rem`);

function unidade(caminho, valor) {
  const [grupo, sub] = caminho;
  if (grupo === 'typography') {
    if (sub === 'size' || sub === 'responsive') return rem(valor);
    if (sub === 'letterSpacing') return valor === 0 ? '0' : `${num(valor)}em`;
    return num(valor); // weight, lineHeight
  }
  if (grupo === 'space') return sub === 'scale' ? rem(valor) : px(valor);
  if (grupo === 'zIndex') return num(valor);
  if (grupo === 'motion') return `${num(valor)}ms`;
  return px(valor);
}

function coletar(no, caminho, saida) {
  if (typeof no === 'number' || typeof no === 'string') {
    const valor = typeof no === 'number' ? unidade(caminho, no) : no;
    saida.push([`--am-${caminho.map(kebab).join('-')}`, valor]);
    return;
  }
  if (no === null || typeof no !== 'object') return;
  // { value: "...", uso: "..." } colapsa na própria folha.
  if ('value' in no) return coletar(no.value, caminho, saida);
  for (const [chave, filho] of Object.entries(no)) {
    if (META.has(chave)) continue;
    coletar(filho, [...caminho, chave], saida);
  }
}

/** @param {Record<string, any>} tokens conteúdo de docs/ux/tokens.json */
export function gerarCss(tokens) {
  const vars = [];
  for (const grupo of GRUPOS) coletar(tokens[grupo], [grupo], vars);
  // Foco: largura/deslocamento ficam fora de "color" nas variáveis.
  const foco = vars.filter(([nome]) => /^--am-color-focus-(width|offset)$/.test(nome));
  // `--am-size-target-min` é emitido no bloco da etapa (que pode sobrescrevê-lo).
  const linhas = vars
    .filter((v) => !foco.includes(v) && v[0] !== '--am-size-target-min')
    .map(([k, v]) => `  ${k}: ${v};`);
  for (const [nome, valor] of foco) linhas.push(`  ${nome.replace('--am-color-focus-', '--am-focus-')}: ${valor};`);

  const etapas = tokens.etapa;
  const bloco = (e) => [
    `  --am-font-base: ${rem(e.fontBase)};`,
    `  --am-size-target-min: ${px(e.target)};`,
    `  --am-radius-extra: ${e.raioExtra}px;`, // sempre com unidade: usado dentro de calc()
  ].join('\n');

  const partes = [
    '/* GERADO por packages/ui/scripts/gerar-tokens.mjs a partir de docs/ux/tokens.json.',
    '   Não edite à mão: altere o JSON (dono: UX) e rode `pnpm --filter @aprendemais/ui tokens`. */',
    '',
    ':root,',
    '[data-etapa="neutra"] {',
    ...linhas,
    '  --am-focus-color: var(--am-color-focus-ring);',
    bloco(etapas.neutra),
    '}',
    '',
    '/* Variações por etapa de ensino (área logada do aluno). */',
  ];
  for (const nome of ['fund1', 'fund2', 'medio']) {
    partes.push(`[data-etapa="${nome}"] {`, bloco(etapas[nome]), '}', '');
  }
  partes.push(
    '/* Superfícies escuras (navy/blue): anel de foco amarelo. */',
    '.am-on-dark {',
    '  --am-focus-color: var(--am-color-focus-ring-on-dark);',
    '}',
    '',
  );
  return partes.join('\n');
}

const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executadoDireto) {
  const css = gerarCss(JSON.parse(readFileSync(TOKENS_JSON, 'utf8')));
  if (process.argv.includes('--check')) {
    let atual = '';
    try {
      atual = readFileSync(TOKENS_CSS, 'utf8');
    } catch {
      /* arquivo ainda não existe */
    }
    if (atual !== css) {
      console.error('tokens.css desatualizado: rode `pnpm --filter @aprendemais/ui tokens`.');
      process.exit(1);
    }
    console.log('tokens.css em dia.');
  } else {
    writeFileSync(TOKENS_CSS, css);
    console.log('tokens.css gerado.');
  }
}
