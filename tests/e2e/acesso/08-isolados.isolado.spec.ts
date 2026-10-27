import { Api, expect, ipAleatorio, soLocal, test } from './base';
import { TEXTO } from './constantes';
import {
  AVISO, apelidoInexistente, axe, cadastrarAlunoPorApi, campoSenha, caminhoDoLink, criarAlunoMaiorAtivo, entrar, esperarEmail, novoAluno, novoEmail,
  tokenDoLink, tokenFalso, vencerLinksDe, vencerSessao
} from './apoio';

// Testes que medem tempo, dependem de uma corrida (SR-08, SR-09/F-01) ou escrevem direto no banco/KV locais para simular
// vencimento (SR-07, SR-11). Rodam no projeto `isolados`, DEPOIS de todos os outros e num worker só (playwright.acesso.config.ts):
// com o `workerd` ocupado, o tempo de resposta vira ruído, a corrida do F-01 some e o `wrangler d1/kv` externo disputa o SQLite
// com a API ("Failed to get session commit token"). Só local (IP forjado, banco e KV do `wrangler dev`).
// Se o projeto principal falhar, o Playwright não roda este; para rodar só ele: `--project=isolados --no-deps`.

test.describe.configure({ mode: 'serial' });

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** Chama a API com IP novo (para não esbarrar nos limites por IP) e devolve quantos ms levou. */
async function medir(api: Api, caminho: string, corpo: unknown): Promise<number> {
  const t = performance.now();
  await api.post(caminho, corpo, { chave: false, headers: { 'cf-connecting-ip': ipAleatorio() } });
  return performance.now() - t;
}

/**
 * Compara dois caminhos em pares alternando quem vai primeiro; o veredito é a mediana das diferenças DENTRO de cada par,
 * que cancela oscilação de carga e viés de ordem (a diferença entre medianas separadas não cancela).
 */
async function diferencaPareada(n: number, a: (i: number) => Promise<number>, b: (i: number) => Promise<number>) {
  const A: number[] = [];
  const B: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      A.push(await a(i));
      B.push(await b(i));
    } else {
      B.push(await b(i));
      A.push(await a(i));
    }
  }
  const diferencas = A.map((t, i) => t - B[i]!);
  return { diferenca: mediana(diferencas), medianaA: mediana(A), medianaB: mediana(B), n };
}

const resumo = (r: { diferenca: number; medianaA: number; medianaB: number; n: number }, a: string, b: string) =>
  `${a} ${r.medianaA.toFixed(1)} ms × ${b} ${r.medianaB.toFixed(1)} ms; mediana das diferenças por par ${r.diferenca.toFixed(1)} ms (n=${r.n})`;

test.beforeEach(() => soLocal('IP forjado por requisição e servidor ocioso'));

test.describe('tempo de resposta não distingue conta existente de inexistente (SR-08)', () => {
  test('login', async ({ api, novoCliente }) => {
    // até 3 falhas por identificador antes do desafio: cada conta tem 2 identificadores (apelido e e-mail) × 3 = 6 amostras
    const identificadores: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = await criarAlunoMaiorAtivo(api);
      identificadores.push(...[c.apelido, c.email].flatMap((id) => [id, id, id]));
    }
    const cli = await novoCliente();
    for (let i = 0; i < 3; i++) await medir(cli, '/sessoes', { identificador: apelidoInexistente(), senha: 'senha-errada-123' }); // aquece

    const r = await diferencaPareada(
      identificadores.length,
      (i) => medir(cli, '/sessoes', { identificador: identificadores[i], senha: 'senha-errada-123' }),
      () => medir(cli, '/sessoes', { identificador: apelidoInexistente(), senha: 'senha-errada-123' })
    );
    expect(Math.abs(r.diferenca), resumo(r, 'existente', 'inexistente')).toBeLessThan(50);
  });

  test('recuperação de acesso', async ({ novoCliente }) => {
    const apelidos: string[] = [];
    // um cliente (IP) por conta: "Sortear outro" é limitado a 10 por IP
    for (let i = 0; i < 12; i++) apelidos.push((await criarAlunoMaiorAtivo(await novoCliente())).apelido);
    const cli = await novoCliente();
    const r = await diferencaPareada(
      apelidos.length,
      (i) => medir(cli, '/recuperacao', { identificador: apelidos[i] }),
      () => medir(cli, '/recuperacao', { identificador: apelidoInexistente() })
    );
    expect(Math.abs(r.diferenca), resumo(r, 'existente', 'inexistente')).toBeLessThan(50);
  });

  test('cadastro com e-mail novo × e-mail já cadastrado (DC-05, estende o SR-08 como pediu o SEG-04)', async ({ api, playwright, baseURL }) => {
    const dono = await criarAlunoMaiorAtivo(api);
    const ctx = await playwright.request.newContext({ baseURL });
    const cli = new Api(ctx);
    async function cadastrar(email: string) {
      const ip = ipAleatorio();
      const s = await cli.get('/cadastro/apelido-sugerido', { headers: { 'cf-connecting-ip': ip } });
      const d = novoAluno('maior');
      const t = performance.now();
      const r = await cli.post('/cadastro/aluno', {
        apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email, senha: d.senha, aviso: AVISO.aluno
      }, { headers: { 'cf-connecting-ip': ip } });
      const ms = performance.now() - t;
      expect(r.status).toBe(201);
      return ms;
    }
    const r = await diferencaPareada(12, () => cadastrar(novoEmail('aluno')), () => cadastrar(dono.email));
    await ctx.dispose();
    expect(Math.abs(r.diferenca), resumo(r, 'e-mail novo', 'e-mail existente')).toBeLessThan(50);
  });
});

test.describe('concorrência no login (SR-09)', () => {
  test('F-01: 30 logins errados em paralelo contra a mesma conta não passam do limite', async ({ novoCliente }) => {
    // O D1 local às vezes devolve 5xx sob rajada ("Failed to get session commit token"). Resposta 5xx não é 401 nem 428/429 e
    // faria o teste concluir errado; por isso repete com conta nova e, se não houver rajada limpa, pula em vez de concluir.
    let porStatus: Record<number, number> | undefined;
    for (let tentativa = 0; tentativa < 3 && !porStatus; tentativa++) {
      const aluno = await criarAlunoMaiorAtivo(await novoCliente());
      const cli = await novoCliente();
      const respostas = await Promise.all(
        Array.from({ length: 30 }, (_, i) => cli.post('/sessoes', { identificador: aluno.apelido, senha: `senha-errada-${i}-xyz` }, { chave: false }))
      );
      const contagem: Record<number, number> = {};
      for (const r of respostas) contagem[r.status] = (contagem[r.status] ?? 0) + 1;
      if (!respostas.some((r) => r.status >= 500)) porStatus = contagem;
    }
    test.skip(!porStatus, 'o D1 local devolveu 5xx nas 3 rajadas: sem medição confiável');
    // cada 401 é uma senha realmente verificada; o aceite do SEG-04 é ≤ 10, o resto em 428/429
    expect(porStatus![401] ?? 0, `status das 30 respostas: ${JSON.stringify(porStatus)}`).toBeLessThanOrEqual(10);
  });
});

test.describe('links e sessão vencidos (simulados direto no banco e no KV locais)', () => {
  test('consentimento vencido (7 d) responde igual a um token que nunca existiu', async ({ page, api, novoCliente }) => {
    soLocal('vence o link direto no banco');
    const responsavel = await novoCliente();
    const d = novoAluno('menor');
    const { apelido } = await cadastrarAlunoPorApi(api, d);
    const e1 = await esperarEmail(api, d.email, 'E1');
    vencerLinksDe(apelido, 'consentimento');

    const vencido = await responsavel.post('/consentimentos/consulta', { token: tokenDoLink(e1) });
    const inexistente = await responsavel.post('/consentimentos/consulta', { token: tokenFalso() });
    expect(vencido.status).toBe(400);
    expect(vencido.corpo).toEqual(inexistente.corpo);
    const concessao = await responsavel.post('/consentimentos/concessao', {
      token: tokenDoLink(e1), nomeResponsavel: 'Responsável de Teste', declaracao: true, aviso: { versao: 'responsavel-2026-10-v1' }
    });
    expect(concessao.corpo.error.code).toBe('TOKEN_INVALIDO');

    await page.goto(caminhoDoLink(e1));
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await expect(page.getByText('O cadastro não autorizado em 7 dias é apagado.')).toBeVisible();
    // a conta não foi liberada
    expect((await responsavel.post('/sessoes', { identificador: apelido, senha: d.senha }, { chave: false })).corpo.data.status).toBe('pendente_responsavel');
  });

  test('confirmação de e-mail vencida (7 d) não ativa a conta', async ({ page, api, novoCliente }) => {
    soLocal('vence o link direto no banco');
    const d = novoAluno('maior');
    const { apelido } = await cadastrarAlunoPorApi(api, d);
    const e3 = await esperarEmail(api, d.email, 'E3');
    vencerLinksDe(d.email, 'confirmacao_email');

    await page.goto(caminhoDoLink(e3));
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    const cli = await novoCliente();
    const login = await cli.post('/sessoes', { identificador: apelido, senha: d.senha }, { chave: false });
    expect(login.corpo.data.status).toBe('pendente_email');
    expect(login.corpo.data.escopoSessao).toBe('pendente');
  });

  test('recuperação vencida (30 min) é recusada e a senha antiga continua valendo', async ({ page, api, novoCliente }) => {
    soLocal('vence o link direto no banco');
    const aluno = await criarAlunoMaiorAtivo(api);
    await api.post('/recuperacao', { identificador: aluno.apelido }, { chave: false });
    const e4 = await esperarEmail(api, aluno.email, 'E4');
    vencerLinksDe(aluno.email, 'recuperacao_senha');

    await page.goto(caminhoDoLink(e4));
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    const cli = await novoCliente();
    const troca = await cli.post('/recuperacao/nova-senha', { token: tokenDoLink(e4), novaSenha: 'qualquer-senha-nova-99' });
    expect(troca.status).toBe(400);
    expect(troca.corpo.error.code).toBe('TOKEN_INVALIDO');
    expect((await cli.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false })).status).toBe(200);
  });
});

test.describe('sessão vencida (SR-07)', () => {
  test('sessão vencida no servidor ou sem cookie leva a "Sua sessão acabou" e o login retoma o destino', async ({ page, api }) => {
    soLocal('vence a sessão direto no KV local');
    const aluno = await criarAlunoMaiorAtivo(api);
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/aluno$/);

    const sid = (await page.context().cookies()).find((c) => c.name === '__Host-sid')?.value;
    expect(sid, 'cookie de sessão').toBeTruthy();
    vencerSessao(sid!);
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();
    await axe(page);

    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await campoSenha(page).fill(aluno.senha);
    await page.getByLabel('Usuário ou e-mail').fill(aluno.apelido);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page, 'retoma a rota que o aluno queria').toHaveURL(/\/aluno$/);

    await page.context().clearCookies();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();
  });
});
