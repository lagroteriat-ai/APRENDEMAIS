import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import {
  NASCIMENTO_MAIOR, SENHA_TESTE, cadastrarAluno, contar, criarContexto, emailFicticio, semearUsuario, todos, tokenDe, ultimoEmail, um
} from './ajuda';

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

describe('POST /cadastro/pendencia/reenvio', () => {
  it('exige sessão: sem cookie → 401; com sessão completa → 403', async () => {
    const { cliente } = criarContexto();
    expect((await cliente.post('/cadastro/pendencia/reenvio')).status).toBe(401);

    await semearUsuario({ apelido: 'GatoFeliz11' });
    const r = await cliente.post('/sessoes', { identificador: 'GatoFeliz11', senha: SENHA_TESTE });
    expect(r.corpo.data.escopoSessao).toBe('completa');
    expect((await cliente.post('/cadastro/pendencia/reenvio')).status).toBe(403);
  });

  it('respeita o intervalo de 5 min (429 com Retry-After) e depois emite novo link, invalidando o anterior', async () => {
    const { cliente, emails } = criarContexto();
    await cadastrarAluno(cliente);
    const tokenAntigo = tokenDe(ultimoEmail(emails, 'E1'));

    const cedo = await cliente.post('/cadastro/pendencia/reenvio');
    expect(cedo.status).toBe(429);
    expect(cedo.corpo.error.code).toBe('RATE_LIMITED');
    expect(cedo.headers.get('Retry-After')).toBe('300');

    avancar(6 * MIN);
    const r = await cliente.post('/cadastro/pendencia/reenvio');
    expect(r.status).toBe(202);
    expect(r.corpo.data).toMatchObject({ tipo: 'responsavel', emailMascarado: 're***@example.test', proximoReenvioEm: '2026-10-22T12:11:00.000Z' });
    expect(emails.filter(m => m.tipo === 'E1')).toHaveLength(2);

    const novo = tokenDe(ultimoEmail(emails, 'E1'));
    expect(novo).not.toBe(tokenAntigo);
    const consulta = cliente.novoNavegador();
    expect((await consulta.post('/consentimentos/consulta', { token: tokenAntigo })).corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await consulta.post('/consentimentos/consulta', { token: novo })).status).toBe(200);
  });

  it('limita a 3 envios por dia', async () => {
    const { cliente, emails } = criarContexto();
    await cadastrarAluno(cliente);
    avancar(6 * MIN);
    expect((await cliente.post('/cadastro/pendencia/reenvio')).status).toBe(202);
    avancar(12 * MIN);
    expect((await cliente.post('/cadastro/pendencia/reenvio')).status).toBe(202);
    avancar(18 * MIN);
    const r = await cliente.post('/cadastro/pendencia/reenvio');
    expect(r.status).toBe(429);
    expect(emails.filter(m => m.tipo === 'E1')).toHaveLength(3);
    // passadas 24 h do primeiro envio, ele sai da janela e libera um novo
    avancar(DIA + 2 * MIN);
    expect((await cliente.post('/cadastro/pendencia/reenvio')).status).toBe(202);
  });

  it('não estende o prazo de 7 dias do pré-cadastro (RQ-05)', async () => {
    const { cliente } = criarContexto();
    await cadastrarAluno(cliente);
    avancar(6 * DIA);
    const r = await cliente.post('/cadastro/pendencia/reenvio');
    expect(r.status).toBe(202);
    expect(r.corpo.data.expiraEm).toBe('2026-10-29T12:00:00.000Z');
  });
});

describe('PUT /cadastro/pendencia/email', () => {
  it('menor: troca o e-mail do responsável, invalida o link antigo e reenvia ao novo (mesmo antes dos 5 min)', async () => {
    const { cliente, emails } = criarContexto();
    await cadastrarAluno(cliente);
    const antigo = tokenDe(ultimoEmail(emails, 'E1'));
    const novoEmail = emailFicticio('pai');

    const r = await cliente.put('/cadastro/pendencia/email', { email: ` ${novoEmail.toUpperCase()} ` });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toMatchObject({ tipo: 'responsavel', emailMascarado: 'pa***@example.test' });
    expect(ultimoEmail(emails, 'E1')?.para).toBe(novoEmail);
    expect(await um('SELECT responsavel_email FROM responsaveis_vinculos')).toEqual({ responsavel_email: novoEmail });
    expect((await cliente.novoNavegador().post('/consentimentos/consulta', { token: antigo })).status).toBe(400);
    expect(await um('SELECT email FROM usuarios')).toEqual({ email: null });
  });

  it('rejeita e-mail inválido e campos extras', async () => {
    const { cliente } = criarContexto();
    await cadastrarAluno(cliente);
    const a = await cliente.put('/cadastro/pendencia/email', { email: 'x' });
    expect(a.status).toBe(400);
    expect(a.corpo.error.details).toEqual([{ path: 'email', code: 'EMAIL_INVALIDO' }]);
    const b = await cliente.put('/cadastro/pendencia/email', { email: emailFicticio('ok'), papel: 'admin' });
    expect(b.corpo.error.details).toEqual([{ path: 'papel', code: 'FORMATO_INVALIDO' }]);
    expect((await criarContexto().cliente.put('/cadastro/pendencia/email', { email: emailFicticio('ok') })).status).toBe(401);
  });

  it('aluno ≥18: troca o próprio e-mail; se for de outra conta, responde igual e avisa o dono (DC-05)', async () => {
    const { cliente, emails } = criarContexto();
    await cadastrarAluno(cliente, { nascimento: NASCIMENTO_MAIOR, email: emailFicticio('antigo') });
    const livre = emailFicticio('livre');
    expect((await cliente.put('/cadastro/pendencia/email', { email: livre })).status).toBe(200);
    expect(ultimoEmail(emails, 'E3')?.para).toBe(livre);
    expect(await um("SELECT email FROM usuarios WHERE papel = 'aluno'")).toEqual({ email: livre });

    const ocupado = emailFicticio('ocupado');
    await semearUsuario({ papel: 'professor', email: ocupado });
    const antes = emails.length;
    const r = await cliente.put('/cadastro/pendencia/email', { email: ocupado });
    expect(r.status).toBe(200);
    expect(await um("SELECT email FROM usuarios WHERE papel = 'aluno'")).toEqual({ email: livre }); // nada mudou
    expect(emails.slice(antes).map(m => m.tipo)).toEqual(['E6']);
    expect(emails.slice(antes)[0]?.para).toBe(ocupado);
  });
});

describe('POST /email/confirmacao', () => {
  async function cadastroMaior() {
    const ctx = criarContexto();
    const { r } = await cadastrarAluno(ctx.cliente, { nascimento: NASCIMENTO_MAIOR, email: emailFicticio('maior') });
    expect(r.status).toBe(201);
    return { ...ctx, token: tokenDe(ultimoEmail(ctx.emails, 'E3')) };
  }

  it('ativa a conta, registra o consentimento do titular e audita sem PII', async () => {
    const { cliente, token } = await cadastroMaior();
    const r = await cliente.novoNavegador().post('/email/confirmacao', { token });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({ status: 'ativa' });
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'ativa' });
    expect(await um("SELECT status, decidido_em FROM consentimentos")).toEqual({ status: 'concedido', decidido_em: INSTANTE_FIXO });
    const auditoria = JSON.stringify(await todos("SELECT * FROM auditoria_acesso WHERE acao = 'conta.email_confirmar'"));
    expect(auditoria).toContain('conta.email_confirmar');
    expect(auditoria).not.toMatch(/@|example\.test/);
  });

  it('o link vale uma vez só', async () => {
    const { cliente, token } = await cadastroMaior();
    const outro = cliente.novoNavegador();
    expect((await outro.post('/email/confirmacao', { token })).status).toBe(200);
    const de_novo = await outro.post('/email/confirmacao', { token });
    expect(de_novo.status).toBe(400);
    expect(de_novo.corpo.error.code).toBe('TOKEN_INVALIDO');
  });

  it('depois de confirmar, a sessão pendente deixa de valer e o login funciona', async () => {
    const { cliente, token } = await cadastroMaior();
    await cliente.novoNavegador().post('/email/confirmacao', { token });
    expect((await cliente.get('/me')).status).toBe(401);
    const apelido = (await um<{ apelido: string }>('SELECT apelido FROM usuarios'))!.apelido;
    const login = await cliente.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    expect(login.corpo.data).toMatchObject({ status: 'ativa', escopoSessao: 'completa' });
  });

  it('rejeita token desconhecido, malformado, vencido e de outro tipo — sempre TOKEN_INVALIDO', async () => {
    const { cliente, token, emails } = await cadastroMaior();
    const n = cliente.novoNavegador();
    const desconhecido = await n.post('/email/confirmacao', { token: 'A'.repeat(43) });
    expect(desconhecido.status).toBe(400);
    expect(desconhecido.corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await n.post('/email/confirmacao', { token: 'curto' })).corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await n.post('/email/confirmacao', {})).corpo.error.details).toEqual([{ path: 'token', code: 'OBRIGATORIO' }]);
    expect((await n.post('/email/confirmacao', { token, extra: 1 })).status).toBe(400);

    // token de consentimento (E1) não serve para confirmar e-mail
    const menor = criarContexto();
    await cadastrarAluno(menor.cliente);
    expect((await menor.cliente.novoNavegador().post('/email/confirmacao', { token: tokenDe(ultimoEmail(menor.emails, 'E1')) })).status).toBe(400);

    avancar(8 * DIA);
    expect((await n.post('/email/confirmacao', { token })).corpo.error.code).toBe('TOKEN_INVALIDO');
    expect(await um('SELECT status FROM usuarios WHERE papel = ?', 'aluno')).toEqual({ status: 'pendente_email' });
    expect(emails.length).toBeGreaterThan(0);
    expect(await contar('usuarios')).toBe(2); // o adulto deste teste e o menor criado acima
  });

  it('limita tentativas por IP (SR-13/T10)', async () => {
    const { cliente } = criarContexto();
    for (let i = 0; i < 60; i++) expect((await cliente.post('/email/confirmacao', { token: 'B'.repeat(43) })).status).toBe(400);
    const r = await cliente.post('/email/confirmacao', { token: 'B'.repeat(43) });
    expect(r.status).toBe(429);
  });
});
