import { expect, ipAleatorio, soLocal, test } from './base';
import { CONVITE_EXPIRADO, TEXTO } from './constantes';
import { axe, campoSenha, caminhoDoLink, criarAlunoMaiorAtivo, criarAlunoMenorAtivo, entrar, esperarEmail, tokenDoLink, tokenFalso } from './apoio';

// Uso único e recuperação de acesso (SR-06, SR-11; DU-03, DC-08). Os casos "vencido" (7 d, 30 min, sessão) escrevem direto no
// banco/KV locais e ficam em `08-isolados.isolado.spec.ts`; só o convite vencido (semente) fica aqui.

test.describe('links desconhecidos ou usados', () => {
  test('em toda página de link, token desconhecido mostra "este link não funciona" (sem dizer o motivo)', async ({ page }) => {
    for (const caminho of ['/responsavel/autorizar', '/confirmar-email', '/recuperar/nova']) {
      for (const query of [`?t=${tokenFalso()}`, '']) {
        await page.goto(caminho + query);
        await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido }), caminho + query).toBeVisible();
      }
      await axe(page);
    }
    await expect(page.getByRole('link', { name: 'Pedir outro link' })).toBeVisible(); // T10 leva de volta a T09
  });

  test('um link truncado (curto demais) também cai na tela "não funciona"', async ({ page }) => {
    // Quem copia o link pela metade não deve ver "Há campos para corrigir" nem um erro técnico.
    for (const caminho of ['/responsavel/autorizar', '/confirmar-email', '/recuperar/nova']) {
      await page.goto(`${caminho}?t=abc`);
      await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido }), caminho).toBeVisible();
    }
  });

  test('o link de recuperação vale uma vez só', async ({ page, api, novoCliente }) => {
    const aluno = await criarAlunoMaiorAtivo(api);
    await api.post('/recuperacao', { identificador: aluno.email }, { chave: false });
    const link = caminhoDoLink(await esperarEmail(api, aluno.email, 'E4'));

    await page.goto(link);
    await campoSenha(page, 'Nova senha').fill(`nova-${aluno.senha}`);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByText('Senha alterada.')).toBeVisible();

    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    const cli = await novoCliente();
    const reuso = await cli.post('/recuperacao/nova-senha', { token: tokenDoLink(await esperarEmail(api, aluno.email, 'E4')), novaSenha: 'outra-senha-valida-77' });
    expect(reuso.status).toBe(400);
    expect(reuso.corpo.error.code).toBe('TOKEN_INVALIDO');
  });
});

test.describe('links vencidos (simulados no banco local)', () => {
  test('convite de professor vencido responde igual a um convite inexistente', async ({ novoCliente }) => {
    soLocal('o convite vencido vem da semente local (scripts/e2e-acesso.mjs)');
    const cli = await novoCliente();
    const vencido = await cli.post('/professores/convites/consulta', { token: CONVITE_EXPIRADO });
    const inexistente = await cli.post('/professores/convites/consulta', { token: tokenFalso() });
    expect(vencido.status).toBe(400);
    expect(vencido.corpo).toEqual(inexistente.corpo);
    const cadastro = await cli.post('/professores', { token: CONVITE_EXPIRADO, nome: 'Professor Vencido', senha: 'giz-de-cera-trinta-e-tres', aviso: { versao: 'professor-2026-10-v1' } });
    expect(cadastro.status).toBe(400);
    expect(cadastro.corpo.error.code).toBe('TOKEN_INVALIDO');
  });
});

test.describe('recuperação de acesso do menor (DU-03)', () => {
  test('o link vai ao responsável, a nova senha encerra as sessões abertas e a antiga deixa de valer', async ({ page, api, browser, baseURL, novoCliente }) => {
    const aluno = await criarAlunoMenorAtivo(api, await novoCliente());

    // dispositivo A do aluno está logado
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/aluno$/);

    // dispositivo B (o responsável) pede a recuperação em T09
    const ctx = await browser.newContext({ baseURL, extraHTTPHeaders: { 'cf-connecting-ip': ipAleatorio() } });
    const resp = await ctx.newPage();
    await resp.goto('/recuperar');
    await axe(resp);
    await resp.getByLabel('Apelido ou e-mail').fill(aluno.apelido);
    await resp.getByRole('button', { name: 'Enviar link' }).click();
    await expect(resp.getByText('Se existir uma conta, o link já está a caminho.')).toBeVisible();
    await axe(resp);

    const e4 = await esperarEmail(api, aluno.email, 'E4'); // e-mail do responsável, não do aluno (menor não tem e-mail)
    expect(e4.para).toBe(aluno.email);
    expect(e4.texto).not.toContain(aluno.senha);

    await resp.goto(caminhoDoLink(e4));
    await expect(resp.getByRole('heading', { level: 1, name: 'Criar nova senha' })).toBeVisible();
    await expect(resp.getByText(`Para ${aluno.apelido}`, { exact: true })).toBeVisible();
    await expect(resp, 'o token sai da URL (RQ-32)').not.toHaveURL(/[?&#]t=/);
    await axe(resp);

    // senha comum é recusada sem gastar o link
    await campoSenha(resp, 'Nova senha').fill('12345678');
    await resp.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(resp.getByText('Essa senha é muito comum. Escolha outra.').first()).toBeVisible();

    const nova = `nova-${aluno.senha}`;
    await campoSenha(resp, 'Nova senha').fill(nova);
    await resp.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(resp).toHaveURL(/\/entrar$/);
    await expect(resp.getByText('Senha alterada.')).toBeVisible();
    await ctx.close();

    // SR-06: o dispositivo A perde a sessão na hora.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page.getByText(TEXTO.loginInvalido)).toBeVisible();
    await entrar(page, aluno.apelido, nova);
    await expect(page).toHaveURL(/\/aluno$/);
  });
});

test.describe('sessão (SR-06, SR-07)', () => {
  test('sair encerra a sessão no servidor: o cookie antigo não vale mais, nem copiado (PEN-067)', async ({ page, api, playwright, baseURL }) => {
    test.fail(true, 'PEN-067: DELETE /sessoes/atual sem corpo recebe 403 do CSRF; a SPA ignora e a sessão segue válida no servidor');
    const aluno = await criarAlunoMaiorAtivo(api);
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/aluno$/);
    const sid = (await page.context().cookies()).find((c) => c.name === '__Host-sid')!.value;

    await page.getByRole('button', { name: aluno.apelido }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    // quem copiou o cookie antes do logout (dispositivo compartilhado, T02) não entra
    const ladrao = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `__Host-sid=${sid}`, 'cf-connecting-ip': ipAleatorio() } });
    expect((await ladrao.get('/api/v1/me')).status()).toBe(401);
    await ladrao.dispose();
  });

  test('sair pela API (DELETE com corpo JSON) encerra a sessão: o cookie antigo dá 401 (SR-06)', async ({ api, novoCliente }) => {
    const aluno = await criarAlunoMaiorAtivo(api);
    const cli = await novoCliente();
    await cli.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false });
    expect((await cli.get('/me')).status).toBe(200);
    const saida = await cli.chamar('DELETE', '/sessoes/atual', { corpo: {}, chave: false });
    expect(saida.status).toBe(200);
    expect(saida.cookies.join(';')).toMatch(/__Host-sid=;.*Max-Age=0/i);
    expect((await cli.get('/me')).status).toBe(401);
    // idempotente: sair de novo, sem sessão, também é 200 (auth.yaml)
    expect((await cli.chamar('DELETE', '/sessoes/atual', { corpo: {}, chave: false })).status).toBe(200);
  });
});
