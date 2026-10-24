import { expect, test } from './base';
import { TEXTO } from './constantes';
import { AVISO, axe, cadastrarAlunoPorApi, criarAlunoMenorAtivo, entrar, esperarEmail, esperarSemEmail, novoAluno, tokenDoLink } from './apoio';

// Consentimento do responsável: gestão, revogação e limites do contrato (RQ-07, RQ-14, RQ-21; SR-06, SR-11; AB3).
// O preparo (cadastro + autorização) vai pela API para ficar rápido; o que está sendo verificado é a revogação.

const DIA_MS = 24 * 3600 * 1000;

test.describe('revogação do consentimento', () => {
  test('o responsável revoga pelo link: a sessão do aluno cai na hora e a conta fica em exclusão', async ({ page, api, novoCliente }) => {
    const responsavel = await novoCliente();
    const aluno = await criarAlunoMenorAtivo(api, responsavel);

    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/aluno$/);
    expect((await page.request.get('/api/v1/me')).status()).toBe(200);

    // T08 (dados): situação atual, depois a revogação em 1 chamada, sem login (RQ-07).
    const antes = await responsavel.post('/consentimentos/gestao/consulta', { token: aluno.tokenGestao });
    expect(antes.status).toBe(200);
    expect(antes.corpo.data).toMatchObject({ apelido: aluno.apelido, situacao: 'autorizada', rankingAutorizado: false, rankingDisponivel: false, exclusaoPrevistaAte: null });

    const rev = await responsavel.post('/consentimentos/gestao/revogacao', { token: aluno.tokenGestao });
    expect(rev.status).toBe(200);
    expect(rev.corpo.data).toMatchObject({ resultado: 'revogado', apelido: aluno.apelido });
    expect(rev.corpo.data.protocolo).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    // RQ-14: dados apagados em até 15 dias.
    const prazo = (Date.parse(rev.corpo.data.exclusaoPrevistaAte) - Date.parse(rev.corpo.data.registradoEm)) / DIA_MS;
    expect(prazo).toBeGreaterThan(14.9);
    expect(prazo).toBeLessThanOrEqual(15);

    // Idempotente: repetir devolve o mesmo protocolo.
    const outra = await responsavel.post('/consentimentos/gestao/revogacao', { token: aluno.tokenGestao });
    expect(outra.status).toBe(200);
    expect(outra.corpo.data.protocolo).toBe(rev.corpo.data.protocolo);

    // SR-06: a sessão que estava aberta morre na próxima requisição, sem esperar o KV.
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();

    // Login com a senha certa não devolve sessão: vai para "conta em exclusão" (T16).
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/conta-em-exclusao$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Esta conta está sendo apagada.' })).toBeVisible();
    await axe(page);
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    await page.goto('/aluno');
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();

    // O link de gestão continua mostrando o estado (com a data prevista), e a recuperação não reabre a conta.
    const depois = await responsavel.post('/consentimentos/gestao/consulta', { token: aluno.tokenGestao });
    expect(depois.corpo.data).toMatchObject({ situacao: 'revogada', exclusaoPrevistaAte: rev.corpo.data.exclusaoPrevistaAte });
    expect((await api.post('/recuperacao', { identificador: aluno.apelido }, { chave: false })).status).toBe(202);
    await esperarSemEmail(api, aluno.email, 'E4');
  });

  test('o aluno revogado não consegue se autorizar de novo com o link antigo do pedido', async ({ api, novoCliente }) => {
    const responsavel = await novoCliente();
    const d = novoAluno('menor');
    await cadastrarAlunoPorApi(api, d);
    const e1 = await esperarEmail(api, d.email, 'E1');
    const concedido = await responsavel.post('/consentimentos/concessao', {
      token: tokenDoLink(e1), nomeResponsavel: 'Responsável de Teste', declaracao: true, aviso: AVISO.responsavel
    });
    expect(concedido.status).toBe(200);
    const e2 = await esperarEmail(api, d.email, 'E2');
    await responsavel.post('/consentimentos/gestao/revogacao', { token: tokenDoLink(e2) });

    const repetida = await responsavel.post('/consentimentos/concessao', {
      token: tokenDoLink(e1), nomeResponsavel: 'Responsável de Teste', declaracao: true, aviso: AVISO.responsavel
    });
    expect(repetida.status).toBe(400);
    expect(repetida.corpo.error.code).toBe('TOKEN_INVALIDO');
  });

  test('tokens de tipos diferentes não se misturam (pedido × gestão)', async ({ api, novoCliente }) => {
    const responsavel = await novoCliente();
    const d = novoAluno('menor');
    await cadastrarAlunoPorApi(api, d);
    const tokenPedido = tokenDoLink(await esperarEmail(api, d.email, 'E1'));

    // o link do pedido não serve para gerir/revogar uma autorização que ainda nem existe
    for (const caminho of ['/consentimentos/gestao/consulta', '/consentimentos/gestao/revogacao']) {
      const r = await responsavel.post(caminho, { token: tokenPedido });
      expect(r.status, caminho).toBe(400);
      expect(r.corpo.error.code).toBe('TOKEN_INVALIDO');
    }
    const lixo = await responsavel.post('/consentimentos/gestao/revogacao', { token: 'x'.repeat(43) });
    expect(lixo.corpo.error.code).toBe('TOKEN_INVALIDO');
  });

  test('o ranking não existe no Sprint 1: nem o pedido nem a gestão aceitam ligá-lo (RQ-21)', async ({ api, novoCliente }) => {
    const responsavel = await novoCliente();
    const d = novoAluno('menor');
    await cadastrarAlunoPorApi(api, d);
    const tokenPedido = tokenDoLink(await esperarEmail(api, d.email, 'E1'));

    const pedido = await responsavel.post('/consentimentos/consulta', { token: tokenPedido });
    expect(pedido.corpo.data.rankingDisponivel).toBe(false);
    const comRanking = await responsavel.post('/consentimentos/concessao', {
      token: tokenPedido, nomeResponsavel: 'Responsável de Teste', declaracao: true, aviso: AVISO.responsavel, rankingAutorizado: true
    });
    expect(comRanking.status).toBe(400);
    expect(comRanking.corpo.error.details).toEqual([{ path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }]);

    // sem declaração marcada também não autoriza
    const semDeclaracao = await responsavel.post('/consentimentos/concessao', {
      token: tokenPedido, nomeResponsavel: 'Responsável de Teste', declaracao: false, aviso: AVISO.responsavel
    });
    expect(semDeclaracao.status).toBe(400);
    // e a conta continua bloqueada
    const login = await api.post('/sessoes', { identificador: d.email, senha: d.senha }, { chave: false });
    expect(login.status).toBe(401);
  });

  // T08 não foi entregue (PEN-043): hoje só existe a API. Quando a tela existir, remova o `fixme`.
  test.fixme('T08: o responsável retira a autorização pela tela, com 1 clique + 1 confirmação (RQ-07, PEN-043)', async ({ page, api, novoCliente }) => {
    const aluno = await criarAlunoMenorAtivo(api, await novoCliente());
    await page.goto(`/responsavel/gerenciar?t=${aluno.tokenGestao}`);
    await expect(page.getByRole('heading', { level: 1, name: `Autorização de ${aluno.apelido}` })).toBeVisible();
    await axe(page);
    await page.getByRole('button', { name: 'Retirar autorização' }).click();
    await page.getByRole('button', { name: 'Retirar', exact: true }).click();
    await expect(page.getByText(/Protocolo/)).toBeVisible();
  });
});
