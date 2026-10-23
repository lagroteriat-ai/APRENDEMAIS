import { env } from 'cloudflare:workers';
import { OPERACOES_AUTH, type OperacaoAuth } from '@aprendemais/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app';
import {
  Cliente, NASCIMENTO_MAIOR, SENHA_TESTE, cadastrarAluno, criarAlunoAutorizado, criarContexto, emailFicticio, semearUsuario, todos
} from './ajuda';

function comEnv(extra: Record<string, unknown>): typeof env {
  return new Proxy(env, { get: (alvo, chave) => (typeof chave === 'string' && chave in extra ? extra[chave] : Reflect.get(alvo, chave)) });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const OPERACOES = Object.entries(OPERACOES_AUTH) as [OperacaoAuth, (typeof OPERACOES_AUTH)[OperacaoAuth]][];

describe('SR-01 — toda rota do contrato existe e nega por padrão', () => {
  it.each(OPERACOES.filter(([id, op]) => op.acesso.startsWith('sessao') && id !== 'sair'))(
    '%s sem cookie → 401 UNAUTHENTICATED',
    async (_id, op) => {
      const { cliente } = criarContexto();
      const r = await cliente.chamar(op.metodo, op.caminho, { corpo: 'corpo' in op ? {} : undefined });
      expect(r.status).toBe(401);
      expect(r.corpo.error.code).toBe('UNAUTHENTICATED');
    }
  );

  it.each(OPERACOES.filter(([id, op]) => !op.acesso.startsWith('sessao') || id === 'sair'))(
    '%s (pública/por link) responde sem exigir sessão e nunca com 404/500',
    async (_id, op) => {
      const { cliente } = criarContexto();
      const r = await cliente.chamar(op.metodo, op.caminho, { corpo: 'corpo' in op ? {} : undefined });
      expect([401, 404, 500]).not.toContain(r.status);
      expect(r.corpo).toMatchObject({ ok: expect.any(Boolean) });
    }
  );

  it('rota desconhecida → 404 NOT_FOUND no formato do ADR; fora de /api/v1 também', async () => {
    const { cliente } = criarContexto();
    const a = await cliente.get('/nao-existe');
    expect(a.status).toBe(404);
    expect(a.corpo).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Você não tem acesso a esta página.' } });
    const res = await cliente.app.fetch(new Request('https://api.test/qualquer'), env);
    expect(res.status).toBe(404);
  });

  it('método errado não executa a rota', async () => {
    const { cliente } = criarContexto();
    expect((await cliente.chamar('GET', '/cadastro/aluno')).status).toBe(404);
    expect((await cliente.chamar('DELETE', '/me')).status).toBe(404);
  });
});

describe('SR-04 — CSRF em todas as rotas que alteram estado', () => {
  it.each(OPERACOES.filter(([, op]) => op.metodo !== 'GET'))('%s recusa Origin de fora com 403', async (_id, op) => {
    const { cliente } = criarContexto();
    const r = await cliente.chamar(op.metodo, op.caminho, { corpo: 'corpo' in op ? {} : undefined, headers: { Origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
    expect(r.corpo.error.code).toBe('FORBIDDEN');
  });

  it('aceita application/json com charset', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.chamar('POST', '/recuperacao', {
      bruto: JSON.stringify({ identificador: 'Alguem01' }), headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    expect(r.status).toBe(202);
  });
});

describe('cabeçalhos de toda resposta (SR-18/19)', () => {
  it.each([
    ['sucesso', (c: Cliente) => c.get('/avisos-privacidade/vigentes')],
    ['erro de validação', (c: Cliente) => c.post('/sessoes', {})],
    ['não autenticado', (c: Cliente) => c.get('/me')],
    ['não encontrado', (c: Cliente) => c.get('/xyz')],
    ['CSRF', (c: Cliente) => c.post('/recuperacao', { identificador: 'abc' }, { headers: { Origin: 'https://evil.example' } })]
  ])('%s: X-Request-Id, no-store e nosniff', async (_nome, chamar) => {
    const { cliente } = criarContexto();
    const r = await chamar(cliente);
    expect(r.headers.get('X-Request-Id')).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Content-Type')).toContain('application/json');
  });

  it('cada resposta tem um X-Request-Id diferente', async () => {
    const { cliente } = criarContexto();
    const a = await cliente.get('/me');
    const b = await cliente.get('/me');
    expect(a.headers.get('X-Request-Id')).not.toBe(b.headers.get('X-Request-Id'));
  });
});

describe('SR-16 — erro interno não vaza detalhe nem PII', () => {
  it('500 devolve mensagem genérica e o log não traz e-mail nem a mensagem do banco com dados', async () => {
    const quebrado = comEnv({
      DB: { prepare: () => { throw new Error('falha no banco para maria@example.test SEGREDO-INTERNO'); } }
    });
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { cliente } = criarContexto({}, quebrado);
    const r = await cliente.get('/cadastro/apelido-sugerido');
    expect(r.status).toBe(500);
    expect(r.corpo).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Algo deu errado. Tente de novo.' } });
    expect(JSON.stringify(r.corpo)).not.toMatch(/SEGREDO|maria|stack|detail/i);
    expect(r.headers.get('X-Request-Id')).toBeTruthy();
    const log = erro.mock.calls.map(c => c.join(' ')).join('\n');
    expect(log).toContain('erro_interno');
    expect(log).toContain(r.headers.get('X-Request-Id')!);
    expect(log).not.toContain('maria@example.test');
  });
});

describe('RQ-30/RQ-31 — nenhum dado pessoal em log, auditoria ou chaves de idempotência', () => {
  it('fluxo completo (cadastro, autorização, login, recuperação) sem vazar e-mail, senha ou token', async () => {
    const logs: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.join(' ')));
    }
    const ctx = criarContexto();
    const { apelido, emailResponsavel, tokenGestao } = await criarAlunoAutorizado(ctx);
    await ctx.cliente.post('/sessoes', { identificador: apelido, senha: 'errada-1234-x' });
    await ctx.cliente.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    await ctx.cliente.post('/recuperacao', { identificador: apelido });
    await cadastrarAluno(ctx.cliente.novoNavegador(), { nascimento: NASCIMENTO_MAIOR, email: emailFicticio('maior') });

    const tokens = ctx.emails.map(m => new URL(m.link).searchParams.get('t')!).concat(tokenGestao);
    const tudo = JSON.stringify(await Promise.all(
      ['auditoria_acesso', 'idempotency_keys'].map(t => todos(`SELECT * FROM ${t}`))
    )) + logs.join('\n');
    for (const proibido of [emailResponsavel, 'example.test', SENHA_TESTE, 'errada-1234-x', apelido, ...tokens]) {
      expect(tudo, `vazou: ${proibido.slice(0, 12)}…`).not.toContain(proibido);
    }
  });

  it('o banco guarda só hash dos tokens de link (nunca o valor do e-mail) e a senha só como Argon2id', async () => {
    const ctx = criarContexto();
    await criarAlunoAutorizado(ctx);
    const tokens = ctx.emails.map(m => new URL(m.link).searchParams.get('t')!);
    const linhas = JSON.stringify(await todos('SELECT * FROM tokens_acao'));
    for (const t of tokens) expect(linhas).not.toContain(t);
    for (const u of await todos<{ credencial_hash: string }>('SELECT credencial_hash FROM usuarios')) {
      expect(u.credencial_hash).toMatch(/^argon2id\$/);
    }
  });
});

describe('ferramenta de desenvolvimento /dev/outbox', () => {
  it('em dev lê a caixa de saída (e-mails gravados no KV); fora de dev não existe', async () => {
    const dev = new Cliente(criarApp(), [], env); // dependências padrão: e-mail vai para o KV
    await cadastrarAluno(dev);
    const caixa = await dev.get('/dev/outbox');
    expect(caixa.status).toBe(200);
    expect(caixa.corpo.data).toHaveLength(1);
    expect(caixa.corpo.data[0]).toMatchObject({ tipo: 'E1', link: expect.stringContaining('/responsavel/autorizar?t=') });
    expect((await dev.get('/dev/outbox?para=outro@example.test')).corpo.data).toHaveLength(0);

    for (const ambiente of ['staging', 'production']) {
      const c = new Cliente(criarApp(), [], comEnv({ ENVIRONMENT: ambiente }));
      const r = await c.get('/dev/outbox');
      expect(r.status, ambiente).toBe(404);
    }
  });

  it('em produção sem provedor de e-mail nada é gravado no KV e o log não revela destinatário nem link', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const prod = comEnv({ ENVIRONMENT: 'production' });
    const c = new Cliente(criarApp(), [], prod);
    const { r } = await cadastrarAluno(c);
    expect(r.status).toBe(201); // o cadastro não depende do envio
    expect((await env.KV.list({ prefix: 'outbox:' })).keys).toHaveLength(0);
    const log = erro.mock.calls.map(x => x.join(' ')).join('\n');
    expect(log).toContain('email_provedor_nao_configurado');
    expect(log).not.toMatch(/example\.test|\/responsavel\/autorizar/);
  });
});

describe('SR-08 — conta existente × inexistente: mesmo tempo de resposta', () => {
  it('login: diferença entre medianas < 50 ms em 30 amostras', async () => {
    const { cliente } = criarContexto();
    await semearUsuario({ apelido: 'PandaCalmo11' });
    const medir = async (id: string): Promise<number> => {
      const ini = performance.now();
      await cliente.novoNavegador().post('/sessoes', { identificador: id, senha: 'errada-1234-x' });
      return performance.now() - ini;
    };
    const mediana = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
    const existe: number[] = [];
    const naoExiste: number[] = [];
    for (let i = 0; i < 30; i++) {
      existe.push(await medir('PandaCalmo11'));
      naoExiste.push(await medir(`Fantasma${i}9`));
    }
    expect(Math.abs(mediana(existe) - mediana(naoExiste))).toBeLessThan(50);
  });
});
