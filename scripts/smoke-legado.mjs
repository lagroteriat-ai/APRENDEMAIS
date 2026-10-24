// Teste de fumaça do Worker legado com `wrangler dev` de verdade (workerd + assets + D1 local), sem tocar na nuvem.
// Cobre: estáticos, cadastro, prototype-access com token, painel admin (listar/excluir) e que docs/, apps/ etc. NÃO são servidos.
// Uso: pnpm smoke:legado   (precisa de rede: o Turnstile de teste da Cloudflare responde em challenges.cloudflare.com)
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js');
const PORTA = Number(process.env.SMOKE_PORT || 8798);
const base = `http://127.0.0.1:${PORTA}`;
const ADMIN = 'token-admin-de-teste';
const vars = [`ADMIN_TOKEN:${ADMIN}`, 'LEAD_SECRET:segredo-lead-de-teste-0123456789', 'TURNSTILE_SECRET:1x0000000000000000000000000000000AA'];
const flagsVars = vars.flatMap((v) => ['--var', v]);

const persistencia = await mkdtemp(join(tmpdir(), 'aprendemais-smoke-'));
const cli = (args) => spawnSync(process.execPath, [wrangler, ...args], { cwd: raiz, encoding: 'utf8' });

let servidor;
const resultados = [];
async function passo(nome, fn) {
  try {
    await fn();
    resultados.push(`ok   ${nome}`);
  } catch (erro) {
    resultados.push(`FALHA ${nome}\n       ${String(erro.message).split('\n').join('\n       ')}`);
    process.exitCode = 1;
  }
}

try {
  const mig = cli(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistencia]);
  if (mig.status !== 0) throw new Error(`migrations falharam:\n${mig.stdout}\n${mig.stderr}`);

  servidor = spawn(process.execPath, [wrangler, 'dev', '--port', String(PORTA), '--ip', '127.0.0.1', '--persist-to', persistencia, ...flagsVars], {
    cwd: raiz, stdio: ['ignore', 'pipe', 'pipe']
  });
  let saida = '';
  servidor.stdout.on('data', (d) => (saida += d));
  servidor.stderr.on('data', (d) => (saida += d));
  const limite = Date.now() + 90_000;
  for (;;) {
    if (/Ready on/.test(saida)) break;
    if (servidor.exitCode !== null) throw new Error(`wrangler dev encerrou:\n${saida}`);
    if (Date.now() > limite) throw new Error(`wrangler dev não ficou pronto:\n${saida}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const chamar = (caminho, init = {}) => fetch(base + caminho, init);
  const json = (corpo) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const admin = { Authorization: `Bearer ${ADMIN}` };
  const lead = {
    nome: 'Ana', sobrenome: 'Silva', email: 'ana@example.test', telefone: '81999990000', perfil: 'Estudante',
    consentimento: true, turnstileToken: 'token-do-widget'
  };
  let cadastro;

  await passo('estáticos: landing, painel, CSS/JS e imagem', async () => {
    for (const [caminho, tipo] of [['/', 'text/html'], ['/index.html', 'text/html'], ['/admin.html', 'text/html'], ['/style.css', 'text/css'], ['/script.js', 'javascript'], ['/admin.js', 'javascript'], ['/assets/estudante.jpg', 'image/jpeg']]) {
      const r = await chamar(caminho);
      assert.equal(r.status, 200, caminho);
      assert.match(r.headers.get('content-type') ?? '', new RegExp(tipo), caminho);
    }
  });

  await passo('docs/, apps/, código e configs NÃO são servidos (SR-21, PEN-016)', async () => {
    const proibidos = [
      '/docs/seguranca/threat-model.md', '/docs/devops/ambientes.md', '/apps/api/wrangler.toml', '/apps/api/src/index.ts',
      '/functions/api/leads.js', '/legacy/worker.js', '/legacy/lib/seguranca.js', '/public/index.html', '/src/worker.js',
      '/wrangler.toml', '/package.json', '/pnpm-lock.yaml', '/DECISOES.md', '/COMUNICACAO.md', '/README.md', '/CLAUDE.md', '/schema.sql',
      '/migrations/0001_leads_inicial.sql', '/db/migrations/0002_usuarios.sql', '/scripts/build-legacy.mjs', '/sprints/SPRINT-01.md',
      '/.dev.vars', '/.git/config', '/dist-legacy/index.html', '/../package.json', '/%2e%2e/package.json'
    ];
    for (const caminho of proibidos) {
      const r = await chamar(caminho);
      assert.equal(r.status, 404, `${caminho} devolveu ${r.status}`);
      const texto = await r.text();
      assert.ok(!/ADMIN_TOKEN|LEAD_SECRET|database_id|threat model/i.test(texto), `${caminho} vazou conteúdo`);
    }
  });

  await passo('rotas desconhecidas e método errado respondem JSON (404/405)', async () => {
    const a = await chamar('/api/nao-existe');
    assert.equal(a.status, 404);
    assert.match(a.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await a.json(), { ok: false, message: 'Recurso não encontrado.' });
    const b = await chamar('/api/leads');
    assert.equal(b.status, 405);
    assert.equal(b.headers.get('allow'), 'POST');
    assert.equal((await b.json()).ok, false);
    const c = await chamar('/api/admin/leads', { method: 'PUT', headers: admin });
    assert.equal(c.status, 405);
    assert.equal(c.headers.get('allow'), 'GET, DELETE');
    assert.equal((await chamar('/api/leads/', json(lead))).status, 200); // barra final tolerada, como nas Pages Functions
  });

  await passo('POST /api/leads: valida, grava e devolve leadId + accessToken', async () => {
    const ruim = await chamar('/api/leads', json({ ...lead, email: 'sem-arroba' }));
    assert.equal(ruim.status, 400);
    const r = await chamar('/api/leads', json(lead));
    assert.equal(r.status, 200);
    cadastro = await r.json();
    assert.equal(cadastro.ok, true);
    assert.ok(Number.isInteger(cadastro.leadId));
    assert.match(cadastro.accessToken, /^[0-9a-f]{64}$/);
    assert.ok(!('detail' in cadastro));
  });

  await passo('POST /api/leads sem Turnstile → 400 e nada é gravado', async () => {
    const { turnstileToken, ...sem } = lead;
    void turnstileToken;
    const r = await chamar('/api/leads', json({ ...sem, email: 'outra@example.test', telefone: '81988887777' }));
    assert.equal(r.status, 400);
  });

  await passo('POST /api/prototype-access: aceita o token certo e rejeita ausente/errado/de outro lead', async () => {
    assert.equal((await chamar('/api/prototype-access', json({ leadId: cadastro.leadId, accessToken: cadastro.accessToken }))).status, 200);
    for (const corpo of [{ leadId: cadastro.leadId }, { leadId: cadastro.leadId, accessToken: 'a'.repeat(64) }, { leadId: cadastro.leadId + 1, accessToken: cadastro.accessToken }]) {
      assert.equal((await chamar('/api/prototype-access', json(corpo))).status, 403, JSON.stringify(corpo).slice(0, 40));
    }
    assert.equal((await chamar('/api/prototype-access', json({}))).status, 400);
  });

  await passo('painel admin: exige token, lista, busca e exclui', async () => {
    assert.equal((await chamar('/api/admin/leads')).status, 401);
    assert.equal((await chamar('/api/admin/leads', { headers: { Authorization: 'Bearer errado' } })).status, 401);
    const lista = await (await chamar('/api/admin/leads', { headers: admin })).json();
    assert.equal(lista.ok, true);
    assert.equal(lista.leads.length, 1);
    assert.equal(lista.leads[0].email, 'ana@example.test');
    assert.equal(lista.leads[0].acessou_prototipo, 1);
    assert.equal(lista.stats.total, 1);
    const busca = await (await chamar('/api/admin/leads?q=ana', { headers: admin })).json();
    assert.equal(busca.leads.length, 1);
    assert.equal((await (await chamar('/api/admin/leads?q=zzz', { headers: admin })).json()).leads.length, 0);

    const del = (corpo, headers = admin) => chamar('/api/admin/leads', { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    assert.equal((await del({ id: lista.leads[0].id }, {})).status, 401);
    assert.equal((await del({})).status, 400);
    assert.equal((await del({ id: lista.leads[0].id })).status, 200);
    assert.equal((await (await chamar('/api/admin/leads', { headers: admin })).json()).leads.length, 0);
  });
} catch (erro) {
  resultados.push(`FALHA preparação\n       ${erro.message}`);
  process.exitCode = 1;
} finally {
  servidor?.kill();
  await new Promise((r) => setTimeout(r, 500));
  await rm(persistencia, { recursive: true, force: true }).catch(() => {});
  console.log(resultados.join('\n'));
  console.log(process.exitCode ? '\nsmoke:legado FALHOU' : '\nsmoke:legado ok');
}
