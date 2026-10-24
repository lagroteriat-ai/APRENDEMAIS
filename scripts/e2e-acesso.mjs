#!/usr/bin/env node
// Servidores do E2E de acesso (S1-QA-03). Uso (chamado pelo playwright.acesso.config.ts):
//   node scripts/e2e-acesso.mjs api   → D1/KV novos em .wrangler/e2e-acesso, migrations + semente, `wrangler dev` em :8787
//   node scripts/e2e-acesso.mjs web   → `vite build` (API real, sem MSW) + `vite preview` em :4173 (proxy /api/v1 → :8787)
// Só usa Node e os binários do próprio workspace (sem pnpm no PATH). Segredos abaixo são descartáveis, só para teste local.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const estado = join(raiz, '.wrangler', 'e2e-acesso');
const PORTA_API = 8787; // fixa: o proxy do Vite (apps/web/vite.config.ts) aponta para ela
const PORTA_WEB = 4173;
const ORIGEM_WEB = `http://localhost:${PORTA_WEB}`;

// Tokens de convite conhecidos pelos testes (tests/e2e/acesso/constantes.ts). Só o hash vai ao banco.
const CONVITE_PROFESSOR = process.env.E2E_CONVITE_PROFESSOR ?? 'e2e-convite-professor-valido-0000000000001';
const CONVITE_EXPIRADO = process.env.E2E_CONVITE_EXPIRADO ?? 'e2e-convite-professor-expirado-000000002';
const EMAIL_PROFESSOR = process.env.E2E_EMAIL_PROFESSOR ?? 'professora.e2e@example.test';
const EMAIL_PROFESSOR_EXPIRADO = process.env.E2E_EMAIL_PROFESSOR_EXPIRADO ?? 'professor.expirado.e2e@example.test';

/** Caminho do executável JS de um pacote instalado no app (os `exports` dos pacotes não expõem `bin/`). */
function binario(app, pacote) {
  const pasta = join(raiz, 'apps', app, 'node_modules', pacote);
  const { bin } = JSON.parse(readFileSync(join(pasta, 'package.json'), 'utf8'));
  return join(pasta, typeof bin === 'string' ? bin : bin[pacote]);
}

function rodar(cwd, args, rotulo) {
  const r = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[e2e-acesso] falhou: ${rotulo}`);
    process.exit(r.status ?? 1);
  }
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

async function api() {
  const dirApi = join(raiz, 'apps', 'api');
  const wrangler = binario('api', 'wrangler');
  rmSync(estado, { recursive: true, force: true });
  mkdirSync(estado, { recursive: true });

  rodar(dirApi, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', estado], 'migrations do D1');

  // Escola e convites de professor (não há tela nem CLI de convite no Sprint 1: DU-04 diz "seed/admin").
  // IDs no alfabeto ULID (sem I, L, O, U), pois a SPA valida o contrato das respostas (`escola.id`).
  const ulidFixo = (prefixo) => prefixo.padEnd(26, '0');
  const [mun, esc, cnv1, cnv2] = ['01JE2EMN', '01JE2EES', '01JE2ECV1', '01JE2ECV2'].map(ulidFixo);
  const sql = [
    `INSERT INTO municipios (id, codigo_ibge, nome) VALUES ('${mun}', '2611606', 'Recife');`,
    `INSERT INTO escolas (id, municipio_id, nome) VALUES ('${esc}', '${mun}', 'Escola E2E');`,
    `INSERT INTO convites (id, escola_id, email, papel, token_hash, expira_em) VALUES ('${cnv1}', '${esc}', '${EMAIL_PROFESSOR}', 'professor', '${sha256(CONVITE_PROFESSOR)}', '2099-01-01T00:00:00.000Z');`,
    `INSERT INTO convites (id, escola_id, email, papel, token_hash, expira_em) VALUES ('${cnv2}', '${esc}', '${EMAIL_PROFESSOR_EXPIRADO}', 'professor', '${sha256(CONVITE_EXPIRADO)}', '2020-01-01T00:00:00.000Z');`
  ].join('\n');
  const arquivoSql = join(estado, 'semente-e2e.sql');
  writeFileSync(arquivoSql, sql);
  rodar(dirApi, [wrangler, 'd1', 'execute', 'DB', '--local', '--persist-to', estado, '--file', arquivoSql], 'semente do E2E');

  const vars = {
    ALLOWED_ORIGINS: ORIGEM_WEB,
    APP_BASE_URL: ORIGEM_WEB,
    TURNSTILE_OBRIGATORIO: 'false',
    IP_HASH_SECRET: 'e2e-ip-hash-secret-0123456789abcdef',
    APP_SECRET: 'e2e-app-secret-0123456789abcdef0123456789',
    TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
    // Argon2id mais barato só neste ambiente descartável (env.ts).
    ARGON2_M_KIB: '1024',
    ARGON2_T: '1'
  };
  const args = [wrangler, 'dev', '--port', String(PORTA_API), '--persist-to', estado, '--show-interactive-dev-session=false'];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  seguir(spawn(process.execPath, args, { cwd: dirApi, stdio: 'inherit' }));
}

function web() {
  const dirWeb = join(raiz, 'apps', 'web');
  const vite = binario('web', 'vite');
  // `vite build` desliga o MSW (vite.config.ts): o navegador fala com a API de verdade pelo proxy do preview.
  rodar(dirWeb, [vite, 'build'], 'build da SPA');
  seguir(spawn(process.execPath, [vite, 'preview', '--port', String(PORTA_WEB), '--strictPort', '--host', 'localhost'], { cwd: dirWeb, stdio: 'inherit' }));
}

function seguir(filho) {
  const encerrar = () => filho.kill();
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
  filho.on('exit', (codigo) => process.exit(codigo ?? 0));
}

const modo = process.argv[2];
if (modo === 'api') await api();
else if (modo === 'web') web();
else {
  console.error('uso: node scripts/e2e-acesso.mjs <api|web>');
  process.exit(2);
}
