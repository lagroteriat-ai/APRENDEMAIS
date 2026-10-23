import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { exigeAcesso } from './acesso';
import { ErroApp, respostaErro } from './lib/http';
import type { AppEnv } from './tipos';
import { Cliente, SENHA_TESTE, cadastrarAluno, criarContexto, emailFicticio, semearUsuario } from '../test/ajuda';

// Middleware de autorização por papel (RQ-35): nega por padrão, papel + escopo da sessão.
function appDeTeste(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('deps', { agora: () => new Date(), enviarEmail: async () => undefined, verificarTurnstile: async () => true });
    c.set('sessao', null);
    c.set('sessaoCarregada', false);
    await next();
  });
  app.get('/qualquer-sessao', exigeAcesso('sessao-pendente'), c => c.text('ok'));
  app.get('/completa', exigeAcesso('sessao-completa'), c => c.text('ok'));
  app.get('/professor', exigeAcesso('sessao-completa', ['professor']), c => c.text('ok'));
  app.get('/gestao', exigeAcesso('sessao-completa', ['gestor', 'admin']), c => c.text('ok'));
  app.get('/publica', exigeAcesso('publico'), c => c.text('ok'));
  app.onError((e, c) => (e instanceof ErroApp ? respostaErro(e) : c.text('erro', 500)));
  return app;
}

async function chamar(app: Hono<AppEnv>, caminho: string, cookie: string | null): Promise<number> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  return (await app.fetch(new Request(`https://x.test${caminho}`, { headers }), env)).status;
}

describe('exigeAcesso', () => {
  it('rota pública passa sem cookie; as demais dão 401 sem sessão', async () => {
    const app = appDeTeste();
    expect(await chamar(app, '/publica', null)).toBe(200);
    for (const rota of ['/qualquer-sessao', '/completa', '/professor', '/gestao']) expect(await chamar(app, rota, null), rota).toBe(401);
    expect(await chamar(app, '/completa', `__Host-sid=${'A'.repeat(43)}`)).toBe(401);
  });

  it('papel: aluno não entra em rota de professor (403); professor entra; gestão exige gestor ou admin', async () => {
    const ctx = criarContexto();
    const app = appDeTeste();
    await semearUsuario({ apelido: 'GatoFeliz11' });
    const emailProf = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email: emailProf });
    const emailAdmin = emailFicticio('admin');
    await semearUsuario({ papel: 'admin', email: emailAdmin });

    const aluno = new Cliente(ctx.cliente.app, ctx.emails);
    await aluno.post('/sessoes', { identificador: 'GatoFeliz11', senha: SENHA_TESTE });
    const prof = new Cliente(ctx.cliente.app, ctx.emails);
    await prof.post('/sessoes', { identificador: emailProf, senha: SENHA_TESTE });
    const admin = new Cliente(ctx.cliente.app, ctx.emails);
    await admin.post('/sessoes', { identificador: emailAdmin, senha: SENHA_TESTE });

    expect(await chamar(app, '/completa', aluno.cookie)).toBe(200);
    expect(await chamar(app, '/professor', aluno.cookie)).toBe(403);
    expect(await chamar(app, '/gestao', aluno.cookie)).toBe(403);
    expect(await chamar(app, '/professor', prof.cookie)).toBe(200);
    expect(await chamar(app, '/gestao', prof.cookie)).toBe(403);
    expect(await chamar(app, '/gestao', admin.cookie)).toBe(200);
    expect(await chamar(app, '/professor', admin.cookie)).toBe(403);
  });

  it('com dois papéis vale o papel ATIVO: quem escolheu aluno não acessa rota de professor', async () => {
    const ctx = criarContexto();
    const app = appDeTeste();
    const email = emailFicticio('multi');
    await semearUsuario({ papel: 'professor', email, papeisExtras: ['aluno'] });
    const c = new Cliente(ctx.cliente.app, ctx.emails);
    await c.post('/sessoes', { identificador: email, senha: SENHA_TESTE });
    expect(await chamar(app, '/professor', c.cookie)).toBe(200); // nenhum papel ativo escolhido: algum papel basta
    await c.put('/sessoes/atual/papel-ativo', { papel: 'aluno' });
    expect(await chamar(app, '/professor', c.cookie)).toBe(403);
    await c.put('/sessoes/atual/papel-ativo', { papel: 'professor' });
    expect(await chamar(app, '/professor', c.cookie)).toBe(200);
  });

  it('sessão pendente: serve onde qualquer sessão basta, mas dá 403 onde se exige sessão completa ou papel (DC-01)', async () => {
    const ctx = criarContexto();
    const app = appDeTeste();
    await cadastrarAluno(ctx.cliente);
    expect(await chamar(app, '/qualquer-sessao', ctx.cliente.cookie)).toBe(200);
    expect(await chamar(app, '/completa', ctx.cliente.cookie)).toBe(403);
    expect(await chamar(app, '/professor', ctx.cliente.cookie)).toBe(403);
  });

  it('perder o papel no banco derruba o acesso na requisição seguinte', async () => {
    const ctx = criarContexto();
    const app = appDeTeste();
    const email = emailFicticio('prof');
    const id = await semearUsuario({ papel: 'professor', email });
    const c = new Cliente(ctx.cliente.app, ctx.emails);
    await c.post('/sessoes', { identificador: email, senha: SENHA_TESTE });
    expect(await chamar(app, '/professor', c.cookie)).toBe(200);
    await env.DB.prepare("UPDATE usuarios SET papel = 'aluno', nome = NULL, email = NULL, apelido = 'SapoLeal10', nascimento_ym = '2000-01', ano_escolar = 'EM3' WHERE id = ?").bind(id).run();
    expect(await chamar(app, '/professor', c.cookie)).toBe(403);
  });
});
