// PEN-004: testes de Turnstile + rate limit em POST /api/leads. Rodar: node --test tests/legado
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarLead } from '../../legacy/rotas/leads.js';

const corpoValido = {
  nome: 'Ana', sobrenome: 'Silva', email: 'ana@example.com',
  telefone: '81999990000', perfil: 'Estudante', consentimento: true,
  turnstileToken: 'token-do-widget'
};

function bancoFalso() {
  const chamadas = [];
  return {
    chamadas,
    prepare(sql) {
      return {
        bind: () => ({
          first: async () => null,
          run: async () => { chamadas.push(sql); return { meta: { last_row_id: 7 } }; }
        })
      };
    }
  };
}

function ambiente(extra = {}) {
  return { DB: bancoFalso(), LEAD_SECRET: 'segredo-de-teste', TURNSTILE_SECRET: 'segredo-turnstile-teste', ...extra };
}

async function enviar(body, env, ip = '203.0.113.9') {
  const request = new Request('https://exemplo.test/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body)
  });
  const resposta = await criarLead(request, env);
  return { status: resposta.status, dados: await resposta.json(), headers: resposta.headers };
}

// Simula o siteverify da Cloudflare.
function simularSiteverify(resultado, { falhaRede = false } = {}) {
  const original = globalThis.fetch;
  const pedidos = [];
  globalThis.fetch = async (url, init) => {
    pedidos.push({ url: String(url), form: Object.fromEntries(init.body.entries()) });
    if (falhaRede) throw new Error('rede indisponível');
    return new Response(JSON.stringify(resultado), { status: 200 });
  };
  return { pedidos, restaurar: () => { globalThis.fetch = original; } };
}

test('token ausente → 400 com mensagem amigável, sem consultar a Cloudflare nem gravar', async () => {
  const sim = simularSiteverify({ success: true });
  try {
    const env = ambiente();
    const { turnstileToken, ...semToken } = corpoValido;
    const { status, dados } = await enviar(semToken, env);
    assert.equal(status, 400);
    assert.equal(dados.ok, false);
    assert.match(dados.message, /não é um robô/);
    assert.equal(sim.pedidos.length, 0);
    assert.equal(env.DB.chamadas.length, 0);
  } finally { sim.restaurar(); }
});

test('token inválido → 400 e nada é gravado', async () => {
  const sim = simularSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
  try {
    const env = ambiente();
    const { status, dados } = await enviar(corpoValido, env);
    assert.equal(status, 400);
    assert.match(dados.message, /verificação de segurança/);
    assert.equal(sim.pedidos.length, 1);
    assert.equal(sim.pedidos[0].form.response, 'token-do-widget');
    assert.equal(sim.pedidos[0].form.remoteip, '203.0.113.9');
    assert.equal(env.DB.chamadas.length, 0);
  } finally { sim.restaurar(); }
});

test('token válido → 200 e lead gravado', async () => {
  const sim = simularSiteverify({ success: true });
  try {
    const env = ambiente();
    const { status, dados } = await enviar(corpoValido, env);
    assert.equal(status, 200);
    assert.equal(dados.ok, true);
    assert.equal(dados.leadId, 7);
    assert.equal(env.DB.chamadas.length, 1);
  } finally { sim.restaurar(); }
});

test('falha ao falar com a Cloudflare → 503 (fecha por segurança) e nada é gravado', async () => {
  const sim = simularSiteverify({}, { falhaRede: true });
  try {
    const env = ambiente();
    const { status, dados } = await enviar(corpoValido, env);
    assert.equal(status, 503);
    assert.match(dados.message, /Tente novamente/);
    assert.equal(env.DB.chamadas.length, 0);
  } finally { sim.restaurar(); }
});

test('TURNSTILE_SECRET ausente → 500 genérico, sem vazar detalhe', async () => {
  const env = ambiente({ TURNSTILE_SECRET: undefined });
  const { status, dados } = await enviar(corpoValido, env);
  assert.equal(status, 500);
  assert.equal(dados.message, 'Serviço indisponível no momento.');
});

test('excesso de requisições por IP → 429 com Retry-After, antes de qualquer outra checagem', async () => {
  const sim = simularSiteverify({ success: true });
  try {
    // Limitador de janela fixa em memória: 5 por IP, igual ao wrangler.toml.
    const contagem = new Map();
    const RATE_LIMITER = {
      async limit({ key }) {
        const n = (contagem.get(key) || 0) + 1;
        contagem.set(key, n);
        return { success: n <= 5 };
      }
    };
    const env = ambiente({ RATE_LIMITER });
    for (let i = 0; i < 5; i++) {
      assert.equal((await enviar(corpoValido, env)).status, 200);
    }
    const sexta = await enviar(corpoValido, env);
    assert.equal(sexta.status, 429);
    assert.equal(sexta.headers.get('Retry-After'), '60');
    assert.match(sexta.dados.message, /Muitas tentativas/);
    assert.equal(sim.pedidos.length, 5); // a 6ª nem chegou ao Turnstile

    // Outro IP não é afetado.
    assert.equal((await enviar(corpoValido, env, '198.51.100.4')).status, 200);
  } finally { sim.restaurar(); }
});
