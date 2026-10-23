import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import {
  NASCIMENTO_MAIOR, SENHA_TESTE, cadastrarAluno, criarAlunoAutorizado, criarContexto, emailFicticio, semearUsuario, todos, tokenDe,
  ultimoEmail, um
} from './ajuda';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

const NOVA_SENHA = 'Outra-Senha-Forte-456';

describe('POST /recuperacao', () => {
  it('conta com e-mail próprio: envia o link (E4) para esse e-mail', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    const r = await cliente.post('/recuperacao', { identificador: email });
    expect(r.status).toBe(202);
    expect(r.corpo).toEqual({ ok: true, data: {} });
    const e4 = ultimoEmail(emails, 'E4');
    expect(e4?.para).toBe(email);
    expect(e4?.link).toContain('/recuperar/nova?t=');
    expect(await um("SELECT expira_em FROM tokens_acao WHERE tipo = 'recuperacao_senha'")).toEqual({ expira_em: '2026-10-22T12:30:00.000Z' });
  });

  it('aluno menor: o link vai para o e-mail do RESPONSÁVEL (DU-03), nunca para o aluno', async () => {
    const ctx = criarContexto();
    const { apelido, emailResponsavel } = await criarAlunoAutorizado(ctx);
    const antes = ctx.emails.length;
    const r = await ctx.cliente.novoNavegador().post('/recuperacao', { identificador: apelido });
    expect(r.status).toBe(202);
    expect(ctx.emails).toHaveLength(antes + 1);
    expect(ultimoEmail(ctx.emails, 'E4')?.para).toBe(emailResponsavel);
  });

  it('mesma resposta (corpo e status) para conta inexistente, e nenhum e-mail sai (SR-08)', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('real');
    await semearUsuario({ papel: 'professor', email });
    const real = await cliente.post('/recuperacao', { identificador: email });
    const falsa = await cliente.novoNavegador().post('/recuperacao', { identificador: 'NaoExiste77' });
    expect(falsa.status).toBe(real.status);
    expect(falsa.corpo).toEqual(real.corpo);
    expect(emails.filter(m => m.tipo === 'E4')).toHaveLength(1);
  });

  it.each([
    ['conta pendente de autorização do responsável', async (ctx: ReturnType<typeof criarContexto>) => (await cadastrarAluno(ctx.cliente)).r.corpo.data.usuario.apelido as string],
    ['conta de aluno ≥18 ainda sem confirmar e-mail', async (ctx: ReturnType<typeof criarContexto>) =>
      (await cadastrarAluno(ctx.cliente, { nascimento: NASCIMENTO_MAIOR, email: emailFicticio('maior') })).r.corpo.data.usuario.apelido as string],
    ['conta em exclusão', async () => {
      await semearUsuario({ apelido: 'PomboLeal31', status: 'suspensa_exclusao' });
      return 'PomboLeal31';
    }]
  ])('não envia nada para %s (mas responde 202)', async (_nome, preparar) => {
    const ctx = criarContexto();
    const identificador = await preparar(ctx);
    const antes = ctx.emails.filter(m => m.tipo === 'E4').length;
    expect((await ctx.cliente.novoNavegador().post('/recuperacao', { identificador })).status).toBe(202);
    expect(ctx.emails.filter(m => m.tipo === 'E4')).toHaveLength(antes);
  });

  it('limita a 3 pedidos por hora por conta (conta inexistente também) e 20 por IP', async () => {
    const { cliente } = criarContexto();
    for (let i = 0; i < 3; i++) expect((await cliente.novoNavegador().post('/recuperacao', { identificador: 'Fantasma01' })).status).toBe(202);
    const r = await cliente.novoNavegador().post('/recuperacao', { identificador: 'Fantasma01' });
    expect(r.status).toBe(429);
    expect(r.corpo.error.code).toBe('RATE_LIMITED');
    expect(r.headers.get('Retry-After')).toBeTruthy();

    const mesmoIp = criarContexto().cliente;
    for (let i = 0; i < 20; i++) expect((await mesmoIp.post('/recuperacao', { identificador: `Alvo${i}00` })).status).toBe(202);
    expect((await mesmoIp.post('/recuperacao', { identificador: 'Alvo99900' })).status).toBe(429);
  });

  it('no máximo 3 e-mails por dia para a mesma conta', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    for (let hora = 0; hora < 4; hora++) {
      avancar(hora * (HORA + MIN));
      expect((await cliente.post('/recuperacao', { identificador: email })).status).toBe(202);
    }
    expect(emails.filter(m => m.tipo === 'E4')).toHaveLength(3);
  });

  it('pedir de novo invalida o link anterior', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    await cliente.post('/recuperacao', { identificador: email });
    const primeiro = tokenDe(ultimoEmail(emails, 'E4'));
    await cliente.post('/recuperacao', { identificador: email });
    const segundo = tokenDe(ultimoEmail(emails, 'E4'));
    expect((await cliente.post('/recuperacao/consulta', { token: primeiro })).status).toBe(400);
    expect((await cliente.post('/recuperacao/consulta', { token: segundo })).status).toBe(200);
  });

  it('com Turnstile obrigatório sem token → 428; valida o corpo', async () => {
    const { cliente } = criarContexto({}, new Proxy(env, { get: (a, k) => (k === 'TURNSTILE_OBRIGATORIO' ? 'true' : Reflect.get(a, k)) }));
    expect((await cliente.post('/recuperacao', { identificador: 'Alguem01' })).status).toBe(428);
    expect((await cliente.post('/recuperacao', { identificador: 'Alguem01', turnstileToken: 'ok' })).status).toBe(202);
    expect((await cliente.post('/recuperacao', {})).corpo.error.details).toEqual([{ path: 'identificador', code: 'OBRIGATORIO' }]);
    expect((await cliente.post('/recuperacao', { identificador: 'Alguem01', extra: 1 })).status).toBe(400);
  });
});

describe('POST /recuperacao/consulta', () => {
  it('mostra o apelido só para menor (T10)', async () => {
    const ctx = criarContexto();
    const { apelido } = await criarAlunoAutorizado(ctx);
    await ctx.cliente.post('/recuperacao', { identificador: apelido });
    const menor = await ctx.cliente.post('/recuperacao/consulta', { token: tokenDe(ultimoEmail(ctx.emails, 'E4')) });
    expect(menor.status).toBe(200);
    expect(menor.corpo.data).toEqual({ apelido, expiraEm: '2026-10-22T12:30:00.000Z' });

    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    await ctx.cliente.novoNavegador().post('/recuperacao', { identificador: email });
    const adulto = await ctx.cliente.post('/recuperacao/consulta', { token: tokenDe(ultimoEmail(ctx.emails, 'E4')) });
    expect(adulto.corpo.data.apelido).toBeNull();
  });

  it('não consome o link e rejeita token desconhecido ou vencido (30 min)', async () => {
    const { cliente, emails } = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    await cliente.post('/recuperacao', { identificador: email });
    const token = tokenDe(ultimoEmail(emails, 'E4'));
    expect((await cliente.post('/recuperacao/consulta', { token })).status).toBe(200);
    expect((await cliente.post('/recuperacao/consulta', { token })).status).toBe(200);
    expect((await cliente.post('/recuperacao/consulta', { token: 'V'.repeat(43) })).corpo.error.code).toBe('TOKEN_INVALIDO');
    avancar(31 * MIN);
    expect((await cliente.post('/recuperacao/consulta', { token })).corpo.error.code).toBe('TOKEN_INVALIDO');
  });
});

describe('POST /recuperacao/nova-senha', () => {
  async function comLink() {
    const ctx = criarContexto();
    const email = emailFicticio('prof');
    await semearUsuario({ papel: 'professor', email });
    await ctx.cliente.post('/recuperacao', { identificador: email });
    return { ...ctx, email, token: tokenDe(ultimoEmail(ctx.emails, 'E4')) };
  }

  it('troca a senha, encerra todas as sessões e o link vale uma vez só', async () => {
    const { cliente, email, token } = await comLink();
    const logado = cliente.novoNavegador();
    expect((await logado.post('/sessoes', { identificador: email, senha: SENHA_TESTE })).status).toBe(200);

    const r = await cliente.novoNavegador().post('/recuperacao/nova-senha', { token, novaSenha: NOVA_SENHA });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({ senhaAlterada: true });

    expect((await logado.get('/me')).status).toBe(401); // SR-06
    const antiga = await cliente.novoNavegador().post('/sessoes', { identificador: email, senha: SENHA_TESTE });
    expect(antiga.status).toBe(401);
    const nova = await cliente.novoNavegador().post('/sessoes', { identificador: email, senha: NOVA_SENHA });
    expect(nova.status).toBe(200);

    const de_novo = await cliente.novoNavegador().post('/recuperacao/nova-senha', { token, novaSenha: 'Mais-Uma-Senha-789' });
    expect(de_novo.status).toBe(400);
    expect(de_novo.corpo.error.code).toBe('TOKEN_INVALIDO');

    const senha = await um<{ credencial_hash: string }>("SELECT credencial_hash FROM usuarios WHERE papel = 'professor'");
    expect(senha?.credencial_hash).toMatch(/^argon2id\$/);
    const auditoria = JSON.stringify(await todos("SELECT * FROM auditoria_acesso WHERE acao = 'conta.senha_redefinir'"));
    expect(auditoria).toContain('conta.senha_redefinir');
    expect(auditoria).not.toMatch(/@|example\.test|Outra-Senha/);
  });

  it('menor: o responsável define a nova senha e o aluno entra com ela', async () => {
    const ctx = criarContexto();
    const { apelido } = await criarAlunoAutorizado(ctx);
    await ctx.cliente.post('/recuperacao', { identificador: apelido });
    const token = tokenDe(ultimoEmail(ctx.emails, 'E4'));
    expect((await ctx.cliente.post('/recuperacao/nova-senha', { token, novaSenha: NOVA_SENHA })).status).toBe(200);
    expect((await ctx.cliente.post('/sessoes', { identificador: apelido, senha: NOVA_SENHA })).status).toBe(200);
  });

  it.each([
    ['senha comum', 'password1', 'SENHA_COMUM'],
    ['senha curta', '1234567', 'SENHA_CURTA'],
    ['senha longa demais', 'a'.repeat(129), 'SENHA_LONGA']
  ])('rejeita %s sem consumir o link', async (_nome, novaSenha, codigo) => {
    const { cliente, token } = await comLink();
    const r = await cliente.post('/recuperacao/nova-senha', { token, novaSenha });
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toEqual([{ path: 'novaSenha', code: codigo }]);
    expect((await cliente.post('/recuperacao/consulta', { token })).status).toBe(200);
  });

  it('rejeita senha igual ao apelido do aluno', async () => {
    const ctx = criarContexto();
    const { apelido } = await criarAlunoAutorizado(ctx);
    await ctx.cliente.post('/recuperacao', { identificador: apelido });
    const r = await ctx.cliente.post('/recuperacao/nova-senha', { token: tokenDe(ultimoEmail(ctx.emails, 'E4')), novaSenha: `${apelido}` + 'x'.repeat(0) });
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toEqual([{ path: 'novaSenha', code: expect.stringMatching(/SENHA_IGUAL_APELIDO|SENHA_CURTA/) }]);
  });

  it('link vencido, desconhecido ou de outro tipo → TOKEN_INVALIDO', async () => {
    const { cliente, token, emails } = await comLink();
    expect((await cliente.post('/recuperacao/nova-senha', { token: 'T'.repeat(43), novaSenha: NOVA_SENHA })).corpo.error.code).toBe('TOKEN_INVALIDO');
    const maior = criarContexto();
    await cadastrarAluno(maior.cliente, { nascimento: NASCIMENTO_MAIOR, email: emailFicticio('maior') });
    const tokenConfirmacao = tokenDe(ultimoEmail(maior.emails, 'E3'));
    expect((await cliente.post('/recuperacao/nova-senha', { token: tokenConfirmacao, novaSenha: NOVA_SENHA })).status).toBe(400);
    avancar(31 * MIN);
    expect((await cliente.post('/recuperacao/nova-senha', { token, novaSenha: NOVA_SENHA })).corpo.error.code).toBe('TOKEN_INVALIDO');
    expect(emails.length).toBeGreaterThan(0);
  });

  it('exige token e senha; recusa campos extras', async () => {
    const { cliente, token } = await comLink();
    expect((await cliente.post('/recuperacao/nova-senha', { token })).corpo.error.details).toEqual([{ path: 'novaSenha', code: 'OBRIGATORIO' }]);
    expect((await cliente.post('/recuperacao/nova-senha', { token, novaSenha: NOVA_SENHA, papel: 'admin' })).status).toBe(400);
  });
});
