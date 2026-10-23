import { exigirSemPii } from '@aprendemais/test-utils';
import { NASCIMENTO_MENOR, SENHA_TESTE, emailFicticio } from '@aprendemais/test-utils';
import { describe, expect, it } from 'vitest';
import { criarCliente } from '../api/cliente';
import { CONTAS_DE_TESTE, bancoVazio, db } from './banco';

/* Contrato do mock: a jornada completa pela API simulada (a mesma que as telas usam).
   Cada resposta de sucesso já é conferida contra o schema do contrato dentro dos handlers. */

describe('API simulada', () => {
  it('as sementes e as contas de teste só têm dados fictícios (sem PII real)', () => {
    exigirSemPii(bancoVazio().usuarios);
    exigirSemPii(CONTAS_DE_TESTE);
  });

  it('jornada: cadastro de menor → pedido → autorização → login → recuperação de senha', async () => {
    const api = criarCliente();
    const sorteio = await api.chamar('sortearApelido');
    const avisos = await api.chamar('obterAvisosVigentes');
    if (!sorteio.ok || !avisos.ok) throw new Error('preparo');

    const email = emailFicticio('responsavel');
    const cadastro = await api.chamar('cadastrarAluno', {
      corpo: {
        apelidoToken: sorteio.data.apelidoToken, nascimento: NASCIMENTO_MENOR, anoEscolar: 'EF5',
        email, senha: SENHA_TESTE, aviso: { versao: avisos.data.aluno.versao },
      },
    });
    expect(cadastro).toMatchObject({ ok: true, status: 201, data: { menor: true, status: 'pendente_responsavel' } });

    // Pendente: a sessão é restrita (só /me e a pendência) e o aluno não entra (RQ-03).
    const me = await api.chamar('obterMe');
    expect(me).toMatchObject({ ok: true, data: { escopoSessao: 'pendente', papeis: [], papelAtivo: null, email: null } });
    const papel = await api.chamar('escolherPapel', { corpo: { papel: 'aluno' } });
    expect(papel).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    const link = db().emails.find((e) => e.tipo === 'E1')!.link;
    const token = new URL(link, 'http://x').searchParams.get('t')!;
    const pedido = await api.chamar('consultarPedidoConsentimento', { corpo: { token } });
    expect(pedido).toMatchObject({ ok: true, data: { apelido: sorteio.data.apelido, rankingDisponivel: false } });

    const conceder = await api.chamar('concederConsentimento', {
      corpo: { token, nomeResponsavel: 'Maria Exemplo', declaracao: true, aviso: { versao: pedido.ok ? pedido.data.aviso.versao : '' }, rankingAutorizado: false },
    });
    expect(conceder).toMatchObject({ ok: true, data: { resultado: 'autorizado' } });

    const login = await api.chamar('entrar', { corpo: { identificador: sorteio.data.apelido.toLowerCase(), senha: SENHA_TESTE } });
    expect(login).toMatchObject({ ok: true, data: { status: 'ativa', escopoSessao: 'completa', me: { papelAtivo: 'aluno' } } });

    await api.chamar('solicitarRecuperacao', { corpo: { identificador: sorteio.data.apelido } });
    const e4 = db().emails.find((e) => e.tipo === 'E4')!;
    expect(e4.para).toBe(email); // menor: o link vai ao responsável (DU-03)
    const t4 = new URL(e4.link, 'http://x').searchParams.get('t')!;
    expect(await api.chamar('consultarRecuperacao', { corpo: { token: t4 } })).toMatchObject({ ok: true, data: { apelido: sorteio.data.apelido } });
    expect(await api.chamar('definirNovaSenha', { corpo: { token: t4, novaSenha: 'nova-senha-ok-123' } })).toMatchObject({ ok: true });
    expect(await api.chamar('definirNovaSenha', { corpo: { token: t4, novaSenha: 'outra-senha-ok-123' } })).toMatchObject({ ok: false, code: 'TOKEN_INVALIDO' });
    expect(await api.chamar('obterMe')).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' }); // trocar a senha encerra a sessão
  });

  it('Idempotency-Key: mesma chave e mesmo corpo repete a resposta; corpo diferente dá 409', async () => {
    const api = criarCliente();
    const s1 = await api.chamar('sortearApelido');
    const s2 = await api.chamar('sortearApelido');
    if (!s1.ok || !s2.ok) throw new Error('preparo');
    const base = { nascimento: NASCIMENTO_MENOR, anoEscolar: 'EF5' as const, email: emailFicticio('responsavel'), senha: SENHA_TESTE, aviso: { versao: 'aluno-2026-10-v1' } };

    const a = await api.chamar('cadastrarAluno', { chave: 'k-1', corpo: { ...base, apelidoToken: s1.data.apelidoToken } });
    const repetida = await api.chamar('cadastrarAluno', { chave: 'k-1', corpo: { ...base, apelidoToken: s1.data.apelidoToken } });
    expect(repetida).toMatchObject({ ok: true, data: a.ok ? a.data : null });
    expect(db().usuarios.filter((u) => u.apelido === s1.data.apelido)).toHaveLength(1);

    const outra = await api.chamar('cadastrarAluno', { chave: 'k-1', corpo: { ...base, apelidoToken: s2.data.apelidoToken } });
    expect(outra).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('corpo com campo desconhecido é recusado (SR-03) e sem Idempotency-Key onde é obrigatória também', async () => {
    const r = await fetch(`${location.origin}/api/v1/sessoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: 'LeaoAzul42', senha: 'x', papel: 'admin' }),
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    expect(db().sessaoUsuarioId).toBeNull();

    const sem = await fetch(`${location.origin}/api/v1/cadastro/aluno`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apelidoToken: 'a'.repeat(40), nascimento: NASCIMENTO_MENOR, anoEscolar: 'EF5', email: 'a@example.test', senha: SENHA_TESTE, aviso: { versao: 'v' } }),
    });
    expect(sem.status).toBe(400);
  });
});
