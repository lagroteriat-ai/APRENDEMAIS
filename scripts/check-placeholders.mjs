// Falha se algum wrangler.toml ainda tiver placeholder (COLOQUE_...) na seção do ambiente alvo.
// Uso: node scripts/check-placeholders.mjs <staging|production> [wrangler.toml ...]
// Sem arquivos informados, verifica os três Workers (legada, api, web).
import { readFile } from 'node:fs/promises';

const [ambiente, ...args] = process.argv.slice(2);
if (!['staging', 'production'].includes(ambiente)) {
  console.error('Uso: check-placeholders.mjs <staging|production> [arquivos...]');
  process.exit(2);
}
const arquivos = args.length
  ? args
  : ['wrangler.toml', 'apps/api/wrangler.toml', 'apps/web/wrangler.toml'];

let pendentes = 0;
for (const arquivo of arquivos) {
  let secao = 'dev';
  const linhas = (await readFile(arquivo, 'utf8')).split(/\r?\n/);
  linhas.forEach((linha, i) => {
    const cabecalho = linha.match(/^\s*\[+env\.([a-z]+)[.\]]/);
    // Convenção: seções do topo (dev) vêm antes de qualquer [env.*]; cada env fica contíguo.
    if (cabecalho) secao = cabecalho[1];
    if (secao === ambiente && !linha.trim().startsWith('#') && linha.includes('COLOQUE_')) {
      console.error(`${arquivo}:${i + 1}: placeholder pendente → ${linha.trim()}`);
      pendentes++;
    }
  });
}

if (pendentes) {
  console.error(`\n${pendentes} placeholder(s) pendente(s) em "${ambiente}". Veja docs/devops/ambientes.md.`);
  process.exit(1);
}
console.log(`Sem placeholders pendentes em "${ambiente}".`);
