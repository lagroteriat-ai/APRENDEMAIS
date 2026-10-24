import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTANTE_FIXO } from '@aprendemais/test-utils';
import { executarRetencao } from '../src/retencao';
import worker from '../src/index';
import {
  SENHA_TESTE, cadastrarAluno, contar, criarAlunoAutorizado, criarContexto, emailFicticio, semearConvite, semearEscola, todos, um
} from './ajuda';

const DIA = 24 * 60 * 60 * 1000;
const avancar = (ms: number): void => {
  vi.setSystemTime(new Date(new Date(INSTANTE_FIXO).getTime() + ms));
};
const rodar = () => executarRetencao(env, new Date());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('retenção — pré-cadastro sem confirmação (RQ-05)', () => {
  it('apaga em cascata só o que passou de 7 dias, inclusive o e-mail do responsável, e audita sem PII', async () => {
    const ctx = criarContexto();
    const velho = await cadastrarAluno(ctx.cliente); // dia 0, menor
    await cadastrarAluno(ctx.cliente.novoNavegador(), { nascimento: '2000-03', email: emailFicticio('maior') }); // dia 0, adulto
    avancar(5 * DIA);
    const novo = await cadastrarAluno(ctx.cliente.novoNavegador()); // dia 5
    avancar(8 * DIA);

    expect(await rodar()).toMatchObject({ preCadastrosApagados: 2, contasAnonimizadas: 0 });
    expect(await contar('usuarios')).toBe(1);
    expect(await um('SELECT apelido FROM usuarios')).toEqual({ apelido: novo.r.corpo.data.usuario.apelido });
    // nada do dia 0 sobrou: vínculo (e-mail do responsável), consentimento e links foram junto
    for (const t of ['responsaveis_vinculos', 'consentimentos', 'tokens_acao']) expect(await contar(t), t).toBe(1);
    expect(JSON.stringify(await todos('SELECT * FROM responsaveis_vinculos'))).not.toContain(velho.corpo.email as string);

    const auditoria = await todos<{ acao: string; ator_papel: string; ator_id: string | null }>("SELECT * FROM auditoria_acesso WHERE acao = 'pre_cadastro.apagar'");
    expect(auditoria).toHaveLength(2);
    expect(auditoria.every(a => a.ator_papel === 'sistema' && a.ator_id === null)).toBe(true);
    expect(JSON.stringify(auditoria)).not.toMatch(/@|example\.test/);
  });

  it('não toca em contas ativas nem em pré-cadastros ainda dentro do prazo', async () => {
    const ctx = criarContexto();
    await criarAlunoAutorizado(ctx); // ativa
    await cadastrarAluno(ctx.cliente.novoNavegador()); // pendente
    avancar(6 * DIA);
    expect(await rodar()).toMatchObject({ preCadastrosApagados: 0, contasAnonimizadas: 0 });
    avancar(9 * DIA);
    expect(await rodar()).toMatchObject({ preCadastrosApagados: 1 }); // só o pendente
    expect(await um('SELECT status FROM usuarios')).toEqual({ status: 'ativa' });
  });

  it('o link de um pré-cadastro apagado deixa de funcionar', async () => {
    const ctx = criarContexto();
    await cadastrarAluno(ctx.cliente);
    const link = new URL(ctx.emails[0]!.link).searchParams.get('t')!;
    avancar(8 * DIA);
    await rodar();
    expect((await ctx.cliente.novoNavegador().post('/consentimentos/consulta', { token: link })).corpo.error.code).toBe('TOKEN_INVALIDO');
  });
});

describe('retenção — exclusão após revogação (RQ-14)', () => {
  async function revogado() {
    const ctx = criarContexto();
    const { apelido, emailResponsavel, tokenGestao } = await criarAlunoAutorizado(ctx);
    const aluno = ctx.cliente.novoNavegador();
    await aluno.post('/sessoes', { identificador: apelido, senha: SENHA_TESTE });
    const responsavel = ctx.cliente.novoNavegador();
    expect((await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenGestao })).status).toBe(200);
    return { ctx, apelido, emailResponsavel, tokenGestao, aluno, responsavel };
  }

  it('anonimiza a conta: some todo dado pessoal, fica só o id; consentimento fica como prova sem PII', async () => {
    const { apelido, emailResponsavel } = await revogado();
    avancar(1 * DIA);
    expect(await rodar()).toMatchObject({ contasAnonimizadas: 1 });

    expect(await um('SELECT status, apelido, nome, email, credencial_hash, nascimento_ym, ano_escolar FROM usuarios')).toEqual({
      status: 'apagada', apelido: null, nome: null, email: null, credencial_hash: null, nascimento_ym: null, ano_escolar: null
    });
    expect(await contar('responsaveis_vinculos')).toBe(0);
    expect(await contar('tokens_acao')).toBe(0);
    expect(await um('SELECT status, vinculo_id, ip_hash FROM consentimentos')).toEqual({ status: 'revogado', vinculo_id: null, ip_hash: null });

    // varredura em todas as tabelas: nem apelido, nem e-mail, nem nome do responsável
    const tabelas = (await todos<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'")).map(t => t.name);
    let tudo = '';
    for (const t of tabelas) tudo += JSON.stringify(await todos(`SELECT * FROM ${t}`));
    for (const proibido of [apelido, emailResponsavel, 'Maria Fictícia', 'example.test']) expect(tudo, proibido).not.toContain(proibido);

    const a = await um<{ acao: string; ator_papel: string }>("SELECT acao, ator_papel FROM auditoria_acesso WHERE acao = 'conta.anonimizar'");
    expect(a).toEqual({ acao: 'conta.anonimizar', ator_papel: 'sistema' });
  });

  it('depois disso não há login, recuperação nem link de gestão', async () => {
    const { ctx, apelido, tokenGestao, aluno, responsavel } = await revogado();
    avancar(1 * DIA);
    await rodar();
    expect((await aluno.get('/me')).status).toBe(401);
    expect((await ctx.cliente.novoNavegador().post('/sessoes', { identificador: apelido, senha: SENHA_TESTE })).status).toBe(401);
    expect((await responsavel.post('/consentimentos/gestao/consulta', { token: tokenGestao })).corpo.error.code).toBe('TOKEN_INVALIDO');
    const antes = ctx.emails.length;
    await ctx.cliente.novoNavegador().post('/recuperacao', { identificador: apelido });
    expect(ctx.emails.length).toBe(antes);
  });

  it('é idempotente: a segunda execução não faz nada', async () => {
    await revogado();
    avancar(1 * DIA);
    await rodar();
    expect(await rodar()).toMatchObject({ preCadastrosApagados: 0, contasAnonimizadas: 0 });
    expect(await contar('usuarios')).toBe(1);
  });
});

describe('retenção — dados vencidos', () => {
  it('apaga links, convites, chaves de idempotência e auditoria depois dos prazos', async () => {
    const ctx = criarContexto();
    await criarAlunoAutorizado(ctx);
    const escola = await semearEscola();
    await semearConvite(escola, emailFicticio('prof'));
    expect(await contar('idempotency_keys')).toBeGreaterThan(0);
    const auditoriasAntes = await contar('auditoria_acesso');

    avancar(2 * DIA); // chaves de idempotência (24 h) já venceram; links e convite ainda dentro de 7 dias após vencer
    let r = await rodar();
    expect(r.chavesIdempotenciaRemovidas).toBeGreaterThan(0);
    expect(r).toMatchObject({ tokensRemovidos: 0, convitesRemovidos: 0, auditoriasRemovidas: 0 });

    avancar(40 * DIA); // links de 30 d + 7 d de folga; convite de 72 h + 7 d
    r = await rodar();
    expect(r.tokensRemovidos).toBeGreaterThan(0);
    expect(r.convitesRemovidos).toBe(1);
    expect(await contar('tokens_acao')).toBe(0);
    expect(await contar('convites')).toBe(0);
    expect(await contar('auditoria_acesso')).toBe(auditoriasAntes); // < 24 meses: fica

    avancar(26 * 30 * DIA);
    r = await rodar();
    expect(r.auditoriasRemovidas).toBe(auditoriasAntes);
    expect(await contar('auditoria_acesso')).toBe(0);
  });
});

describe('Cron Trigger (scheduled)', () => {
  it('o handler agendado executa a retenção e registra só contagens no log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ctx = criarContexto();
    await cadastrarAluno(ctx.cliente);
    avancar(8 * DIA);

    const exec = createExecutionContext();
    await worker.scheduled(createScheduledController({ scheduledTime: new Date() }), env, exec);
    await waitOnExecutionContext(exec);

    expect(await contar('usuarios')).toBe(0);
    const linha = log.mock.calls.map(c => c.join(' ')).find(l => l.includes('retencao_concluida'));
    expect(JSON.parse(linha!)).toMatchObject({ evento: 'retencao_concluida', preCadastrosApagados: 1, contasAnonimizadas: 0 });
    expect(linha).not.toMatch(/@|example\.test/);
  });
});
