import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import { exigeAcesso } from '../src/acesso';
import { hmacHex } from '../src/lib/crypto';
import { ErroApp, respostaErro } from '../src/lib/http';
import type { AppEnv } from '../src/tipos';
import {
  AVISO_RESPONSAVEL, Cliente, SENHA_TESTE, cadastrarAluno, criarAlunoAutorizado, criarContexto, tokenDe, todos, ultimoEmail, um
} from './ajuda';

const DIA = 24 * 60 * 60 * 1000;
const avancarMs = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

/** Um "recurso" qualquer da plataforma: exige sessão completa (conta ativa = com consentimento). */
function appComRecurso(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('deps', { agora: () => new Date(), enviarEmail: async () => undefined, verificarTurnstile: async () => true });
    c.set('sessao', null);
    c.set('sessaoCarregada', false);
    await next();
  });
  app.get('/atividades', exigeAcesso('sessao-completa', ['aluno']), c => c.json({ ok: true, data: ['atividade'] }));
  app.onError((e, c) => (e instanceof ErroApp ? respostaErro(e) : c.text('erro', 500)));
  return app;
}

const acessar = async (app: Hono<AppEnv>, c: Cliente): Promise<number> =>
  (await app.fetch(new Request('https://x.test/atividades', { headers: c.cookie ? { Cookie: c.cookie } : {} }), env)).status;

describe('aluno <18 sem acesso a recursos até o responsável confirmar (RQ-03)', () => {
  it('pendente (logo após o cadastro e depois de entrar) → 403; autorizado → 200; revogado → 401', async () => {
    const ctx = criarContexto();
    const app = appComRecurso();
    const { r } = await cadastrarAluno(ctx.cliente);
    const apelido = r.corpo.data.usuario.apelido as string;
    expect(await acessar(app, ctx.cliente)).toBe(403); // sessão do cadastro

    const entrando = ctx.cliente.novoNavegador();
    expect((await entrando.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE })).corpo.data.escopoSessao).toBe('pendente');
    expect(await acessar(app, entrando)).toBe(403); // sessão do login, ainda pendente

    const token = tokenDe(ultimoEmail(ctx.emails, 'E1'));
    const responsavel = ctx.cliente.novoNavegador();
    await responsavel.post('/consentimentos/concessao', {
      token, nomeResponsavel: 'Maria Fictícia', declaracao: true, aviso: AVISO_RESPONSAVEL
    });
    expect(await acessar(app, entrando)).toBe(401); // a sessão pendente caduca: é preciso entrar de novo
    const aluno = ctx.cliente.novoNavegador();
    await aluno.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    expect(await acessar(app, aluno)).toBe(200);

    const tokenGestao = tokenDe(ultimoEmail(ctx.emails, 'E2'));
    await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao });
    expect(await acessar(app, aluno)).toBe(401); // a mesma sessão, na requisição seguinte
    const depois = ctx.cliente.novoNavegador();
    await depois.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    expect(await acessar(app, depois)).toBe(401);
  });

  it('recusa do responsável: o aluno nunca chega a ter acesso', async () => {
    const ctx = criarContexto();
    const app = appComRecurso();
    const { r } = await cadastrarAluno(ctx.cliente);
    await ctx.cliente.novoNavegador().post('/consentimentos/recusa', { token: tokenDe(ultimoEmail(ctx.emails, 'E1')) });
    expect(await acessar(app, ctx.cliente)).toBe(401);
    const login = await ctx.cliente.novoNavegador().post('/sessoes', { identificador: r.corpo.data.usuario.apelido, senha: SENHA_TESTE });
    expect(login.status).toBe(401);
  });

  it('o pedido não autorizado em 7 dias expira: o link morre e a conta continua sem acesso', async () => {
    const ctx = criarContexto();
    const app = appComRecurso();
    const { r } = await cadastrarAluno(ctx.cliente);
    const token = tokenDe(ultimoEmail(ctx.emails, 'E1'));
    avancarMs(7 * DIA - 1000);
    expect((await ctx.cliente.novoNavegador().post('/consentimentos/consulta', { token })).status).toBe(200); // 1 s antes
    avancarMs(7 * DIA);
    expect((await ctx.cliente.novoNavegador().post('/consentimentos/consulta', { token })).corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await ctx.cliente.novoNavegador().post('/consentimentos/concessao', {
      token, nomeResponsavel: 'Maria Fictícia', declaracao: true, aviso: AVISO_RESPONSAVEL
    })).status).toBe(400);
    // a sessão do cadastro também caducou (7 dias); entrando de novo a conta segue pendente e sem acesso
    const entrando = ctx.cliente.novoNavegador();
    await entrando.post('/sessoes', { identificador: r.corpo.data.usuario.apelido, senha: SENHA_TESTE });
    expect(await acessar(app, entrando)).toBe(403);
  });
});

describe('evidência do consentimento: versão do texto, data e IP hasheado (RQ-06)', () => {
  async function conceder(ip: string) {
    const ctx = criarContexto();
    await cadastrarAluno(ctx.cliente);
    const responsavel = new Cliente(ctx.cliente.app, ctx.emails, env, ip);
    const r = await responsavel.post('/consentimentos/concessao', {
      token: tokenDe(ultimoEmail(ctx.emails, 'E1')), nomeResponsavel: 'Maria Fictícia', declaracao: true, aviso: AVISO_RESPONSAVEL
    });
    expect(r.status).toBe(200);
    return um<{ versao_texto: string; decidido_em: string; ip_hash: string | null }>('SELECT versao_texto, decidido_em, ip_hash FROM consentimentos ORDER BY rowid DESC LIMIT 1');
  }

  it('grava versão, instante e HMAC do IP (nunca o IP)', async () => {
    const ip = '198.51.100.23';
    const c = await conceder(ip);
    expect(c?.versao_texto).toBe('responsavel-2026-10-v1');
    expect(c?.decidido_em).toBe(INSTANTE_FIXO);
    expect(c?.ip_hash).toBe(await hmacHex(env.IP_HASH_SECRET, ip));
    expect(c?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    // o IP em claro não está em nenhuma tabela
    const tabelas = ['consentimentos', 'auditoria_acesso', 'idempotency_keys', 'tokens_acao', 'usuarios', 'responsaveis_vinculos'];
    for (const t of tabelas) expect(JSON.stringify(await todos(`SELECT * FROM ${t}`)), t).not.toContain(ip);
  });

  it('IPs diferentes geram hashes diferentes; sem IP o campo fica nulo', async () => {
    const a = await conceder('198.51.100.1');
    const outro = await conceder('198.51.100.2');
    expect(outro?.ip_hash).not.toBe(a?.ip_hash);
    const semIp = await conceder('');
    expect(semIp?.ip_hash).toBeNull();
  });
});

describe('provedor de e-mail abstraído', () => {
  it('falha do provedor não derruba o cadastro nem a autorização (o envio roda depois da resposta)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = criarContexto({ enviarEmail: async () => { throw new Error('provedor fora do ar para pai@example.test'); } });
    const { r } = await cadastrarAluno(ctx.cliente);
    expect(r.status).toBe(201);
    expect(await um('SELECT COUNT(*) AS n FROM tokens_acao')).toEqual({ n: 1 });
    // o pedido de reenvio também segue funcionando e o log não carrega o endereço
    avancarMs(6 * 60 * 1000);
    expect((await ctx.cliente.post('/cadastro/pendencia/reenvio')).status).toBe(202);
    expect(erro.mock.calls.map(c => c.join(' ')).join('\n')).not.toContain('pai@example.test');
  });

  it('o fluxo todo envia E1 (pedido), E2 (gestão) e E4 (recuperação) pelo provedor, cada um com seu link', async () => {
    const ctx = criarContexto();
    const { apelido } = await criarAlunoAutorizado(ctx);
    await ctx.cliente.novoNavegador().post('/recuperacao', { identificador: apelido });
    expect(ctx.emails.map(m => m.tipo)).toEqual(['E1', 'E2', 'E4']);
    const caminhos = ctx.emails.map(m => new URL(m.link).pathname);
    expect(caminhos).toEqual(['/responsavel/autorizar', '/responsavel/gerenciar', '/recuperar/nova']);
    expect(ctx.emails.every(m => new URL(m.link).searchParams.get('t')!.length >= 32)).toBe(true);
    expect(ctx.emails[0]!.assunto).toContain(apelido);
  });
});
