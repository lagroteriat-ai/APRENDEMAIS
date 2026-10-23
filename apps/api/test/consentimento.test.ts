import { describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import {
  AVISO_RESPONSAVEL, SENHA_TESTE, cadastrarAluno, contar, criarContexto, todos, tokenDe, ultimoEmail, um, type Contexto
} from './ajuda';

const DIA = 24 * 60 * 60 * 1000;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};

const NOME_RESPONSAVEL = 'Maria Responsável Fictícia';

async function cadastroMenor(): Promise<Contexto & { apelido: string; tokenPedido: string; responsavel: Contexto['cliente'] }> {
  const ctx = criarContexto();
  const { r } = await cadastrarAluno(ctx.cliente);
  expect(r.status).toBe(201);
  return {
    ...ctx,
    apelido: r.corpo.data.usuario.apelido,
    tokenPedido: tokenDe(ultimoEmail(ctx.emails, 'E1')),
    responsavel: ctx.cliente.novoNavegador() // outro navegador: o responsável não tem a sessão do aluno
  };
}

const corpoConcessao = (token: string, extra: Record<string, unknown> = {}) => ({
  token, nomeResponsavel: NOME_RESPONSAVEL, declaracao: true, aviso: AVISO_RESPONSAVEL, ...extra
});

async function autorizado() {
  const c = await cadastroMenor();
  const r = await c.responsavel.post('/consentimentos/concessao', corpoConcessao(c.tokenPedido));
  expect(r.status).toBe(200);
  return { ...c, concessao: r.corpo.data, tokenGestao: tokenDe(ultimoEmail(c.emails, 'E2')) };
}

describe('POST /consentimentos/consulta', () => {
  it('mostra o pedido ao responsável sem consumir o link e sem expor dados além do apelido', async () => {
    const { responsavel, apelido, tokenPedido } = await cadastroMenor();
    for (let i = 0; i < 2; i++) {
      const r = await responsavel.post('/consentimentos/consulta', { token: tokenPedido });
      expect(r.status).toBe(200);
      expect(r.corpo.data).toEqual({
        apelido,
        aviso: { versao: 'responsavel-2026-10-v1', publicadoEm: '2026-10-22T00:00:00.000Z' },
        rankingDisponivel: false,
        expiraEm: '2026-10-29T12:00:00.000Z'
      });
    }
  });

  it('recusa token desconhecido, vencido e de outro tipo', async () => {
    const { responsavel, tokenPedido, emails } = await cadastroMenor();
    expect((await responsavel.post('/consentimentos/consulta', { token: 'Z'.repeat(43) })).corpo.error.code).toBe('TOKEN_INVALIDO');
    avancar(8 * DIA);
    expect((await responsavel.post('/consentimentos/consulta', { token: tokenPedido })).status).toBe(400);
    expect(emails.length).toBe(1);
  });
});

describe('POST /consentimentos/concessao', () => {
  it('registra o consentimento, ativa a conta, envia o link de gestão (E2) e audita sem PII', async () => {
    const { concessao, apelido, emails } = await autorizado();
    expect(concessao).toMatchObject({ resultado: 'autorizado', apelido, registradoEm: INSTANTE_FIXO });
    expect(concessao.protocolo).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    expect(await um('SELECT status, decidido_em, versao_texto, length(ip_hash) AS ip FROM consentimentos')).toEqual({
      status: 'concedido', decidido_em: INSTANTE_FIXO, versao_texto: 'responsavel-2026-10-v1', ip: 64
    });
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'ativa' });
    expect(await um('SELECT responsavel_nome, confirmado_em FROM responsaveis_vinculos')).toEqual({
      responsavel_nome: NOME_RESPONSAVEL, confirmado_em: INSTANTE_FIXO
    });
    expect(ultimoEmail(emails, 'E2')?.link).toContain('/responsavel/gerenciar?t=');
    expect((await um<{ n: number }>("SELECT COUNT(*) AS n FROM tokens_acao WHERE consumido_em IS NOT NULL"))?.n).toBe(1);

    const auditoria = JSON.stringify(await todos("SELECT * FROM auditoria_acesso WHERE acao = 'consentimento.conceder'"));
    expect(auditoria).toContain(concessao.protocolo);
    expect(auditoria).not.toMatch(/@|example\.test|Maria|Fictícia/);
  });

  it('o aluno passa a entrar, e a sessão pendente antiga deixa de valer', async () => {
    const { cliente, apelido } = await autorizado();
    expect((await cliente.get('/me')).status).toBe(401);
    const login = await cliente.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    expect(login.corpo.data).toMatchObject({ status: 'ativa', escopoSessao: 'completa', me: { papeis: ['aluno'], papelAtivo: 'aluno' } });
  });

  it('o link vale uma vez só', async () => {
    const { responsavel, tokenPedido } = await autorizado();
    const r = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido));
    expect(r.status).toBe(400);
    expect(r.corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await responsavel.post('/consentimentos/consulta', { token: tokenPedido })).status).toBe(400);
  });

  it('repetir a mesma Idempotency-Key devolve o mesmo protocolo, sem novo e-mail nem nova linha', async () => {
    const { responsavel, tokenPedido, emails } = await cadastroMenor();
    const chave = crypto.randomUUID();
    const a = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido), { idempotencia: chave });
    const b = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido), { idempotencia: chave });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.corpo.data).toEqual(a.corpo.data);
    expect(b.headers.get('Idempotent-Replayed')).toBe('true');
    expect(emails.filter(m => m.tipo === 'E2')).toHaveLength(1);
    expect(await contar('consentimentos')).toBe(1);
    const c = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido, { nomeResponsavel: 'Outro Nome' }), { idempotencia: chave });
    expect(c.status).toBe(409);
    expect(c.corpo.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it.each([
    ['declaração desmarcada', { declaracao: false }, { path: 'declaracao', code: 'DECLARACAO_OBRIGATORIA' }],
    ['nome curto', { nomeResponsavel: 'M' }, { path: 'nomeResponsavel', code: 'NOME_INVALIDO' }],
    ['aviso desatualizado', { aviso: { versao: 'responsavel-2020-v0' } }, { path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' }],
    ['ranking antes de existir (RQ-21)', { rankingAutorizado: true }, { path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }],
    ['campo desconhecido', { status: 'concedido' }, { path: 'status', code: 'FORMATO_INVALIDO' }]
  ])('rejeita %s sem consumir o link', async (_nome, extra, esperado) => {
    const { responsavel, tokenPedido } = await cadastroMenor();
    const r = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido, extra));
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toContainEqual(esperado);
    expect(await um('SELECT status FROM consentimentos')).toEqual({ status: 'pendente' });
    expect((await responsavel.post('/consentimentos/consulta', { token: tokenPedido })).status).toBe(200); // link intacto
  });

  it('exige Idempotency-Key', async () => {
    const { responsavel, tokenPedido } = await cadastroMenor();
    const r = await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido), { idempotencia: false });
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toEqual([{ path: 'Idempotency-Key', code: 'OBRIGATORIO' }]);
  });

  it('o próprio aluno não se autoriza com a sessão dele (AB3) → 403, e o link continua valendo', async () => {
    const { cliente, responsavel, tokenPedido } = await cadastroMenor();
    const r = await cliente.post('/consentimentos/concessao', corpoConcessao(tokenPedido)); // cliente = navegador do aluno
    expect(r.status).toBe(403);
    expect(r.corpo.error.code).toBe('FORBIDDEN');
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'pendente_responsavel' });
    expect((await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido))).status).toBe(200);
  });

  it('não aceita link vencido', async () => {
    const { responsavel, tokenPedido } = await cadastroMenor();
    avancar(8 * DIA);
    expect((await responsavel.post('/consentimentos/concessao', corpoConcessao(tokenPedido))).status).toBe(400);
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'pendente_responsavel' });
  });
});

describe('POST /consentimentos/recusa', () => {
  it('apaga o pré-cadastro, o e-mail do responsável e os links (RQ-05) e audita', async () => {
    const { cliente, responsavel, tokenPedido } = await cadastroMenor();
    const r = await responsavel.post('/consentimentos/recusa', { token: tokenPedido });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({ resultado: 'recusado' });
    for (const t of ['usuarios', 'responsaveis_vinculos', 'consentimentos', 'tokens_acao']) expect(await contar(t)).toBe(0);
    const auditoria = JSON.stringify(await todos("SELECT * FROM auditoria_acesso WHERE acao = 'consentimento.recusar'"));
    expect(auditoria).toContain('consentimento.recusar');
    expect(auditoria).not.toMatch(/@|example\.test/);
    expect((await cliente.get('/me')).status).toBe(401);
    expect((await responsavel.post('/consentimentos/recusa', { token: tokenPedido })).corpo.error.code).toBe('TOKEN_INVALIDO');
  });

  it('não vale para token inválido nem depois da autorização', async () => {
    const { responsavel, tokenPedido } = await autorizado();
    expect((await responsavel.post('/consentimentos/recusa', { token: tokenPedido })).status).toBe(400);
    expect((await responsavel.post('/consentimentos/recusa', { token: 'Q'.repeat(43) })).status).toBe(400);
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'ativa' });
  });
});

describe('gestão da autorização (T08)', () => {
  it('consulta devolve a situação e só aceita o link de gestão', async () => {
    const { responsavel, apelido, tokenGestao, tokenPedido } = await autorizado();
    const r = await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({
      apelido, situacao: 'autorizada', autorizadoEm: INSTANTE_FIXO, rankingAutorizado: false, rankingDisponivel: false, exclusaoPrevistaAte: null
    });
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: tokenPedido })).status).toBe(400); // link de outro tipo
    avancar(31 * DIA);
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao })).corpo.error.code).toBe('TOKEN_INVALIDO');
  });

  it('o link de gestão é reutilizável dentro dos 30 dias', async () => {
    const { responsavel, tokenGestao } = await autorizado();
    avancar(29 * DIA);
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao })).status).toBe(200);
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao })).status).toBe(200);
  });

  it('ranking: desligar é idempotente; ligar ainda não existe (RQ-21)', async () => {
    const { responsavel, tokenGestao } = await autorizado();
    const off = await responsavel.put('/consentimentos/gestao/ranking', { token: tokenGestao, rankingAutorizado: false });
    expect(off.status).toBe(200);
    expect(off.corpo.data.rankingAutorizado).toBe(false);
    const on = await responsavel.put('/consentimentos/gestao/ranking', { token: tokenGestao, rankingAutorizado: true });
    expect(on.status).toBe(400);
    expect(on.corpo.error.details).toEqual([{ path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }]);
    expect((await responsavel.put('/consentimentos/gestao/ranking', { token: tokenGestao })).status).toBe(400);
  });

  it('revogar bloqueia a conta na hora, derruba a sessão do aluno e marca a exclusão em 15 dias', async () => {
    const { cliente, responsavel, apelido, tokenGestao, concessao } = await autorizado();
    const aluno = cliente.novoNavegador();
    expect((await aluno.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE })).corpo.data.escopoSessao).toBe('completa');
    expect((await aluno.get('/me')).status).toBe(200);

    const r = await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao });
    expect(r.status).toBe(200);
    expect(r.corpo.data).toEqual({
      resultado: 'revogado', protocolo: concessao.protocolo, apelido, registradoEm: INSTANTE_FIXO, exclusaoPrevistaAte: '2026-11-06T12:00:00.000Z'
    });
    expect(await um('SELECT status, revogado_em FROM consentimentos')).toEqual({ status: 'revogado', revogado_em: INSTANTE_FIXO });
    expect(await um('SELECT status, exclusao_solicitada_em, sessao_versao FROM usuarios')).toEqual({
      status: 'suspensa_exclusao', exclusao_solicitada_em: INSTANTE_FIXO, sessao_versao: 2
    });

    // SR-06: a sessão aberta antes da revogação cai na requisição seguinte
    expect((await aluno.get('/me')).status).toBe(401);
    const login = await aluno.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    expect(login.status).toBe(200);
    expect(login.corpo.data).toEqual({ status: 'suspensa_exclusao', escopoSessao: 'nenhuma', me: null });
    expect(login.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);

    const acoes = (await todos<{ acao: string }>('SELECT acao FROM auditoria_acesso')).map(a => a.acao);
    expect(acoes).toEqual(expect.arrayContaining(['consentimento.revogar', 'conta.exclusao_solicitar']));
  });

  it('revogar é idempotente e a gestão passa a mostrar "revogada"', async () => {
    const { responsavel, tokenGestao } = await autorizado();
    const a = await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao });
    avancar(DIA);
    const b = await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao });
    expect(b.status).toBe(200);
    expect(b.corpo.data).toEqual(a.corpo.data);
    const g = await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao });
    expect(g.corpo.data).toMatchObject({ situacao: 'revogada', exclusaoPrevistaAte: '2026-11-06T12:00:00.000Z' });
  });

  it('token inválido → 400 TOKEN_INVALIDO em todas as operações de gestão', async () => {
    const { responsavel } = await cadastroMenor();
    const token = 'W'.repeat(43);
    for (const [metodo, caminho, corpo] of [
      ['POST', '/consentimentos/gestao/consulta', { token }],
      ['PUT', '/consentimentos/gestao/ranking', { token, rankingAutorizado: false }],
      ['POST', '/consentimentos/gestao/revogacao', { token }]
    ] as const) {
      const r = await responsavel.chamar(metodo, caminho, { corpo });
      expect(r.status, caminho).toBe(400);
      expect(r.corpo.error.code, caminho).toBe('TOKEN_INVALIDO');
    }
  });
});

describe('POST /consentimentos/gestao/novo-link', () => {
  it('sempre 202, igual para token desconhecido (sem enumeração) — e só envia e-mail se o token existe', async () => {
    const { responsavel, emails, tokenGestao } = await autorizado();
    const antes = emails.length;
    const desconhecido = await responsavel.post('/consentimentos/gestao/novo-link', { token: 'K'.repeat(43) });
    expect(desconhecido.status).toBe(202);
    expect(desconhecido.corpo).toEqual({ ok: true, data: {} });
    expect(emails.length).toBe(antes);

    avancar(31 * DIA); // link vencido
    const r = await responsavel.post('/consentimentos/gestao/novo-link', { token: tokenGestao });
    expect(r.status).toBe(202);
    expect(r.corpo).toEqual(desconhecido.corpo);
    const novo = ultimoEmail(emails, 'E2');
    expect(emails.length).toBe(antes + 1);
    expect(novo?.link).toContain('/responsavel/gerenciar?t=');
    const t = tokenDe(novo);
    expect(t).not.toBe(tokenGestao);
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: t })).status).toBe(200);
  });

  it('não renova link de consentimento já revogado', async () => {
    const { responsavel, emails, tokenGestao } = await autorizado();
    await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao });
    const antes = emails.length;
    expect((await responsavel.post('/consentimentos/gestao/novo-link', { token: tokenGestao })).status).toBe(202);
    expect(emails.length).toBe(antes);
  });
});
