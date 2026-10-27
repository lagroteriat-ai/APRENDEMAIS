// Guardas estáticas dos wrangler.toml, sem credenciais (PEN-056). Roda antes dos dry-runs de `pnpm check:wrangler`.
//  1. O topo (DEV) não pode ter URL pública: workers_dev e preview_urls devem ser false.
//  2. scripts/deploy.mjs precisa recusar deploy sem --env (ou com ambiente desconhecido).
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arquivos = ['wrangler.toml', 'apps/api/wrangler.toml', 'apps/web/wrangler.toml'];
let erros = 0;

for (const arquivo of arquivos) {
  const topo = [];
  for (const linha of (await readFile(arquivo, 'utf8')).split(/\r?\n/)) {
    if (/^\s*\[+env\./.test(linha)) break; // fim do topo: 1º [env.*]
    topo.push(linha);
  }
  for (const chave of ['workers_dev', 'preview_urls']) {
    const m = topo.join('\n').match(new RegExp(`^${chave}\\s*=\\s*(\\w+)`, 'm'));
    if (!m || m[1] !== 'false') {
      console.error(`${arquivo}: ${chave} do topo (DEV) deve ser false (achei ${m ? m[1] : 'ausente'}).`);
      erros++;
    }
  }
}

const deploy = fileURLToPath(new URL('./deploy.mjs', import.meta.url));
for (const args of [[], ['dev'], ['staging', '--outro']]) {
  const r = spawnSync('node', [deploy, ...args], { stdio: 'ignore' });
  if (r.status !== 2) {
    console.error(`deploy.mjs ${args.join(' ')}: deveria recusar (saída 2), saiu com ${r.status}.`);
    erros++;
  }
}

if (erros) process.exit(1);
console.log('Guardas dos wrangler.toml ok (topo sem URL pública; deploy recusa --env ausente/inválido).');
