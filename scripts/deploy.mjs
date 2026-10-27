// Comando de deploy dos Workers Builds. Recusa rodar sem --env válido (PEN-056): o topo do wrangler.toml é o ambiente
// DEV e nunca deve ser publicado. Rode na pasta do Worker (raiz = landing, apps/api, apps/web).
// Uso: node [../../]scripts/deploy.mjs <staging|production> [--versao]
//   (sem flag)  wrangler deploy --env <amb>            → branch de produção do Worker
//   --versao    wrangler versions upload --env <amb>   → branches de PR (Preview URL, sem promover tráfego)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [ambiente, ...flags] = process.argv.slice(2);
if (!['staging', 'production'].includes(ambiente) || flags.some(f => f !== '--versao')) {
  console.error('Uso: deploy.mjs <staging|production> [--versao]\nRecusado: deploy sem --env válido publicaria o ambiente DEV.');
  process.exit(2);
}

const shell = process.platform === 'win32';
const executar = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Placeholders COLOQUE_* (PEN-002) só deste Worker.
executar('node', [fileURLToPath(new URL('./check-placeholders.mjs', import.meta.url)), ambiente, 'wrangler.toml']);
const subcomando = flags.includes('--versao') ? ['versions', 'upload'] : ['deploy'];
executar('pnpm', ['exec', 'wrangler', ...subcomando, '--env', ambiente]);
