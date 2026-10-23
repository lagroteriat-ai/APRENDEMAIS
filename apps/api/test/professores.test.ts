import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import {
  AVISO_PROFESSOR, SENHA_TESTE, contar, criarContexto, emailFicticio, semearConvite, semearEscola, semearUsuario, todos, tokenDe,
  ultimoEmail, um
} from './ajuda';

const DIA = 24 * 60 * 60 * 1000;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

async function conviteDe(papel: 'professor' | 'gestor' = 'professor') {
  const escola = await semearEscola('Escola Municipal Fictícia');
  const email = emailFicticio('prof');
  const token = await semearConvite(escola, email, papel);
  return { escola, email, token };
}

const corpoCadastro = (token: string, extra: Record<string, unknown> = {}) => ({
  token, nome: '  Ana Souza Fictícia ', senha: SENHA_TESTE, aviso: AVISO_PROFESSOR, ...extra
});

describe('POST /professores/convites/consulta', () => {
  it('mostra o e-mail do convite, a escola e o aviso, sem consumir o convite', async () => {
    const { cliente } = criarContexto();
    const { email, token, escola } = await conviteDe();
    for (let i = 0; i < 2; i++) {
      const r = await cliente.post('/professores/convites/consulta', { token });
      expect(r.status).toBe(200);
      expect(r.corpo.data).toEqual({
        email,
        escola: { id: escola, nome: 'Escola Municipal Fictícia' },
        aviso: { versao: 'professor-2026-10-v1', publicadoEm: '2026-10-22T00:00:00.000Z' },
        expiraEm: '2026-10-25T12:00:00.000Z'
      });
    }
  });

  it('recusa convite desconhecido, vencido (72 h) ou já usado', async () => {
    const { cliente } = criarContexto();
    const { token } = await conviteDe();
    expect((await cliente.post('/professores/convites/consulta', { token: 'N'.repeat(43) })).corpo.error.code).toBe('TOKEN_INVALIDO');
    avancar(4 * DIA);
    expect((await cliente.post('/professores/convites/consulta', { token })).corpo.error.code).toBe('TOKEN_INVALIDO');
  });
});

describe('POST /professores', () => {
  it('cria a conta pendente, vincula à escola, resgata o convite e pede confirmação de e-mail (E3)', async () => {
    const { cliente, emails } = criarContexto();
    const { token, email, escola } = await conviteDe();
    const r = await cliente.post('/professores', corpoCadastro(token));
    expect(r.status).toBe(201);
    expect(r.corpo.data).toMatchObject({
      usuario: { nome: 'Ana Souza Fictícia' },
      status: 'pendente_email',
      pendencia: { tipo: 'email', emailMascarado: 'pr***@example.test', expiraEm: '2026-10-29T12:00:00.000Z' }
    });
    expect(r.headers.get('Set-Cookie')).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=\d+$/);

    const u = await um<Record<string, unknown>>('SELECT * FROM usuarios');
    expect(u).toMatchObject({ papel: 'professor', status: 'pendente_email', email, nome: 'Ana Souza Fictícia', apelido: null });
    expect(u?.credencial_hash).toMatch(/^argon2id\$/);
    expect(await um('SELECT escola_id, papel FROM escola_membros')).toEqual({ escola_id: escola, papel: 'professor' });
    const convite = await um<{ aceito_em: string; aceito_por: string }>('SELECT aceito_em, aceito_por FROM convites');
    expect(convite).toEqual({ aceito_em: INSTANTE_FIXO, aceito_por: u?.id });
    expect(await um('SELECT concedido_por, status, versao_texto FROM consentimentos')).toEqual({
      concedido_por: 'titular', status: 'pendente', versao_texto: 'professor-2026-10-v1'
    });
    expect(ultimoEmail(emails, 'E3')?.para).toBe(email);
    const auditoria = JSON.stringify(await todos('SELECT * FROM auditoria_acesso'));
    expect(auditoria).toMatch(/convite\.aceitar/);
    expect(auditoria).not.toMatch(/@|example\.test|Ana/);
  });

  it('fluxo completo: confirma o e-mail, entra e vê escola e papel em /me', async () => {
    const { cliente, emails } = criarContexto();
    const { token, email } = await conviteDe();
    await cliente.post('/professores', corpoCadastro(token));
    expect((await cliente.get('/me')).corpo.data).toMatchObject({ status: 'pendente_email', nome: null, email: null, papeis: [] });
    expect((await cliente.novoNavegador().post('/email/confirmacao', { token: tokenDe(ultimoEmail(emails, 'E3')) })).status).toBe(200);

    const login = await cliente.novoNavegador().post('/sessoes', { identificador: email, senha: SENHA_TESTE });
    expect(login.corpo.data.me).toMatchObject({
      status: 'ativa', apelido: null, nome: 'Ana Souza Fictícia', email, papeis: ['professor'], papelAtivo: 'professor',
      escola: { nome: 'Escola Municipal Fictícia' }
    });
  });

  it('convite de gestor cria conta com o papel gestor', async () => {
    const { cliente } = criarContexto();
    const { token } = await conviteDe('gestor');
    expect((await cliente.post('/professores', corpoCadastro(token))).status).toBe(201);
    expect(await um('SELECT papel FROM usuarios')).toEqual({ papel: 'gestor' });
    expect(await um('SELECT papel FROM escola_membros')).toEqual({ papel: 'gestor' });
  });

  it('o convite vale uma vez só', async () => {
    const { cliente } = criarContexto();
    const { token } = await conviteDe();
    expect((await cliente.post('/professores', corpoCadastro(token))).status).toBe(201);
    const r = await cliente.novoNavegador().post('/professores', corpoCadastro(token));
    expect(r.status).toBe(400);
    expect(r.corpo.error.code).toBe('TOKEN_INVALIDO');
    expect(await contar('usuarios')).toBe(1);
  });

  it('idempotência: mesma chave devolve a mesma conta; corpo diferente → 409', async () => {
    const { cliente, emails } = criarContexto();
    const { token } = await conviteDe();
    const chave = crypto.randomUUID();
    const a = await cliente.post('/professores', corpoCadastro(token), { idempotencia: chave });
    const b = await cliente.post('/professores', corpoCadastro(token), { idempotencia: chave });
    expect(b.status).toBe(201);
    expect(b.headers.get('Idempotent-Replayed')).toBe('true');
    expect(b.corpo.data.usuario).toEqual(a.corpo.data.usuario);
    expect(await contar('usuarios')).toBe(1);
    expect(emails.filter(m => m.tipo === 'E3')).toHaveLength(1);
    expect((await cliente.post('/professores', corpoCadastro(token, { nome: 'Outra Pessoa' }), { idempotencia: chave })).status).toBe(409);
  });

  it('e-mail do convite já tem conta → 409 EMAIL_EM_USO e o convite NÃO é gasto', async () => {
    const { cliente } = criarContexto();
    const { token, email } = await conviteDe();
    await semearUsuario({ papel: 'professor', email });
    const r = await cliente.post('/professores', corpoCadastro(token));
    expect(r.status).toBe(409);
    expect(r.corpo.error).toMatchObject({ code: 'CONFLICT', details: [{ path: 'email', code: 'EMAIL_EM_USO' }] });
    expect((await um<{ aceito_em: string | null }>('SELECT aceito_em FROM convites'))?.aceito_em).toBeNull();
  });

  it('sem convite válido não existe cadastro de professor (SR-22)', async () => {
    const { cliente } = criarContexto();
    const r = await cliente.post('/professores', corpoCadastro('X'.repeat(43)));
    expect(r.status).toBe(400);
    expect(r.corpo.error.code).toBe('TOKEN_INVALIDO');
    expect(await contar('usuarios')).toBe(0);
    const { token } = await conviteDe();
    avancar(4 * DIA);
    expect((await cliente.post('/professores', corpoCadastro(token))).status).toBe(400);
    expect(await contar('usuarios')).toBe(0);
  });

  it.each([
    ['campo desconhecido (papel)', { papel: 'admin' }, { path: 'papel', code: 'FORMATO_INVALIDO' }],
    ['e-mail no corpo (vem do convite)', { email: 'outro@example.test' }, { path: 'email', code: 'FORMATO_INVALIDO' }],
    ['aviso desatualizado', { aviso: { versao: 'professor-2020' } }, { path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' }],
    ['senha comum', { senha: 'password1' }, { path: 'senha', code: 'SENHA_COMUM' }],
    ['senha curta', { senha: '1234567' }, { path: 'senha', code: 'SENHA_CURTA' }],
    ['nome curto', { nome: 'A' }, { path: 'nome', code: 'NOME_INVALIDO' }]
  ])('rejeita %s sem gastar o convite', async (_nome, extra, esperado) => {
    const { cliente } = criarContexto();
    const { token } = await conviteDe();
    const r = await cliente.post('/professores', corpoCadastro(token, extra));
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toContainEqual(esperado);
    expect(await contar('usuarios')).toBe(0);
    expect((await um<{ aceito_em: string | null }>('SELECT aceito_em FROM convites'))?.aceito_em).toBeNull();
  });

  it('exige Idempotency-Key e respeita CSRF', async () => {
    const { cliente } = criarContexto();
    const { token } = await conviteDe();
    expect((await cliente.post('/professores', corpoCadastro(token), { idempotencia: false })).status).toBe(400);
    expect((await cliente.post('/professores', corpoCadastro(token), { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect(await contar('usuarios')).toBe(0);
    expect(env.ENVIRONMENT).toBe('dev');
  });
});
