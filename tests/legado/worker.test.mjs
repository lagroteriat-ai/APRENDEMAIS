// S1-BE-05: roteamento e contratos HTTP do Worker legado (legacy/worker.js). Rodar: node --test tests/legado
// O teste com wrangler dev de verdade (estáticos, D1, o que NÃO é servido) está em scripts/smoke-legado.mjs (pnpm smoke:legado).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../legacy/worker.js';

const ADMIN_TOKEN = 'token-admin-de-teste';
const LEAD_SECRET = 'segredo-lead-de-teste-0123456789';

/** D1 falso: guarda os leads em memória e entende só as consultas que o Worker faz. */
function bancoFalso() {
  const leads = [];
  let proximoId = 1;
  return {
    leads,
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      const executar = (binds) => ({
        first: async () => {
          if (s.startsWith('SELECT id FROM leads WHERE')) return leads.find((l) => l.email === binds[0] || l.telefone === binds[1]) ?? null;
          if (s.includes('COUNT(*) AS total')) return { total: leads.length, hoje: leads.length, acessaram: leads.filter((l) => l.acessou_prototipo).length };
          return null;
        },
        all: async () => ({ results: s.includes('LIKE') ? leads.filter((l) => l.email.includes(binds[0].replaceAll('%', ''))) : [...leads] }),
        run: async () => {
          if (s.startsWith('INSERT INTO leads')) {
            leads.push({ id: proximoId, nome: binds[0], sobrenome: binds[1], email: binds[2], telefone: binds[3], perfil: binds[4], acessou_prototipo: 0 });
            return { meta: { last_row_id: proximoId++ } };
          }
          if (s.startsWith('UPDATE leads SET acessou_prototipo')) {
            const l = leads.find((x) => x.id === binds[0]);
            if (l) l.acessou_prototipo = 1;
          }
          if (s.startsWith('DELETE FROM leads')) leads.splice(0, leads.length, ...leads.filter((l) => l.id !== binds[0]));
          return { meta: {} };
        }
      });
      return { bind: (...binds) => executar(binds), ...executar([]) };
    }
  };
}

function ambiente(extra = {}) {
  return { DB: bancoFalso(), ADMIN_TOKEN, LEAD_SECRET, TURNSTILE_SECRET: 'segredo-turnstile-teste', ...extra };
}

async function chamar(env, caminho, { metodo = 'GET', corpo, token } = {}) {
  const headers = { 'CF-Connecting-IP': '203.0.113.7' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const resposta = await worker.fetch(new Request(`https://exemplo.test${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) }), env, {});
  const texto = await resposta.text();
  return { status: resposta.status, headers: resposta.headers, dados: texto ? JSON.parse(texto) : null };
}

// Turnstile sempre aprova nestes testes (a validação em si é testada em leads-protecao.test.mjs).
function aprovarTurnstile() {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  return () => { globalThis.fetch = original; };
}

const lead = { nome: 'Ana', sobrenome: 'Silva', email: 'ana@example.test', telefone: '81999990000', perfil: 'Estudante', consentimento: true, turnstileToken: 't' };

test('rota desconhecida → 404 JSON; fora de /api também (o Worker só recebe /api/*)', async () => {
  const env = ambiente();
  for (const caminho of ['/api/nao-existe', '/api', '/api/leads/extra', '/', '/index.html', '/api/constructor', '/api/__proto__']) {
    const r = await chamar(env, caminho);
    assert.equal(r.status, 404, caminho);
    assert.match(r.headers.get('Content-Type'), /application\/json/);
    assert.deepEqual(r.dados, { ok: false, message: 'Recurso não encontrado.' });
  }
});

test('método errado → 405 JSON com Allow', async () => {
  const env = ambiente();
  const casos = [
    ['/api/leads', 'GET', 'POST'], ['/api/leads', 'DELETE', 'POST'],
    ['/api/prototype-access', 'GET', 'POST'], ['/api/prototype-access', 'PUT', 'POST'],
    ['/api/admin/leads', 'POST', 'GET, DELETE'], ['/api/admin/leads', 'PUT', 'GET, DELETE'], ['/api/admin/leads', 'PATCH', 'GET, DELETE']
  ];
  for (const [caminho, metodo, permitido] of casos) {
    const r = await chamar(env, caminho, { metodo });
    assert.equal(r.status, 405, `${metodo} ${caminho}`);
    assert.equal(r.headers.get('Allow'), permitido);
    assert.equal(r.dados.ok, false);
  }
  // métodos herdados do protótipo de objetos não viram handler
  assert.equal((await chamar(env, '/api/leads', { metodo: 'TOSTRING' })).status, 405);
});

test('barra final e querystring não mudam a rota', async () => {
  const env = ambiente();
  assert.equal((await chamar(env, '/api/admin/leads/?q=x', { token: ADMIN_TOKEN })).status, 200);
  assert.equal((await chamar(env, '/api/admin/leads//')).status, 401);
});

test('fluxo completo: cadastro → prototype-access com token → painel lista, busca e exclui', async () => {
  const restaurar = aprovarTurnstile();
  try {
    const env = ambiente();
    const cad = await chamar(env, '/api/leads', { metodo: 'POST', corpo: lead });
    assert.equal(cad.status, 200);
    assert.equal(cad.dados.ok, true);
    assert.match(cad.dados.accessToken, /^[0-9a-f]{64}$/);

    const proto = await chamar(env, '/api/prototype-access', { metodo: 'POST', corpo: { leadId: cad.dados.leadId, accessToken: cad.dados.accessToken } });
    assert.equal(proto.status, 200);

    const lista = await chamar(env, '/api/admin/leads', { token: ADMIN_TOKEN });
    assert.equal(lista.status, 200);
    assert.equal(lista.dados.leads.length, 1);
    assert.equal(lista.dados.leads[0].acessou_prototipo, 1);
    assert.equal(lista.dados.stats.total, 1);
    assert.equal((await chamar(env, '/api/admin/leads?q=ana', { token: ADMIN_TOKEN })).dados.leads.length, 1);

    const del = await chamar(env, '/api/admin/leads', { metodo: 'DELETE', corpo: { id: lista.dados.leads[0].id }, token: ADMIN_TOKEN });
    assert.equal(del.status, 200);
    assert.equal((await chamar(env, '/api/admin/leads', { token: ADMIN_TOKEN })).dados.leads.length, 0);
  } finally { restaurar(); }
});

test('prototype-access rejeita token ausente, errado, de outro lead e segredo não configurado (PEN-003)', async () => {
  const restaurar = aprovarTurnstile();
  try {
    const env = ambiente();
    const { dados } = await chamar(env, '/api/leads', { metodo: 'POST', corpo: lead });
    const tentar = (e, corpo) => chamar(e, '/api/prototype-access', { metodo: 'POST', corpo });
    assert.equal((await tentar(env, { leadId: dados.leadId })).status, 403);
    assert.equal((await tentar(env, { leadId: dados.leadId, accessToken: 'x'.repeat(64) })).status, 403);
    assert.equal((await tentar(env, { leadId: dados.leadId + 1, accessToken: dados.accessToken })).status, 403);
    assert.equal((await tentar({ ...env, LEAD_SECRET: undefined }, { leadId: dados.leadId, accessToken: dados.accessToken })).status, 403);
    assert.equal((await tentar(env, {})).status, 400);
    assert.equal(env.DB.leads[0].acessou_prototipo, 0);
  } finally { restaurar(); }
});

test('painel admin: sem token, token errado ou ADMIN_TOKEN não configurado → 401 (PEN-006)', async () => {
  const env = ambiente();
  for (const [e, token] of [[env, undefined], [env, 'errado'], [env, ADMIN_TOKEN + 'x'], [{ ...env, ADMIN_TOKEN: undefined }, ADMIN_TOKEN]]) {
    assert.equal((await chamar(e, '/api/admin/leads', { token })).status, 401);
    assert.equal((await chamar(e, '/api/admin/leads', { metodo: 'DELETE', corpo: { id: 1 }, token })).status, 401);
  }
});

test('nenhuma resposta vaza mensagem interna quando o banco falha', async () => {
  const log = console.error;
  console.error = () => {};
  try {
    const quebrado = ambiente({ DB: { prepare: () => { throw new Error('SEGREDO-INTERNO sqlite://x'); } } });
    for (const [caminho, opcoes] of [
      ['/api/admin/leads', { token: ADMIN_TOKEN }],
      ['/api/admin/leads', { metodo: 'DELETE', corpo: { id: 1 }, token: ADMIN_TOKEN }],
      ['/api/prototype-access', { metodo: 'POST', corpo: { leadId: 1, accessToken: 'a'.repeat(64) } }]
    ]) {
      const r = await chamar(quebrado, caminho, opcoes);
      assert.ok(r.status >= 400, caminho);
      assert.ok(!JSON.stringify(r.dados).includes('SEGREDO'), caminho);
    }
  } finally { console.error = log; }
});
