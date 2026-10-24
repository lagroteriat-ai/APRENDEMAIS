import { expect, ipAleatorio, test, type Api } from './base';
import { TEXTO } from './constantes';
import {
  AVISO, axe, cadastrarPelaTela, caminhoDoLink, entrar, esperarEmail, novoAluno, novoEmail, tokenDoLink, type DadosAluno
} from './apoio';

// Aluno menor de 18 (fluxos.md §4; T05–T07; RQ-03, RQ-04, RQ-05, RQ-08; SR-12; AB3).
// Responsável: sem conta, age por link (DU-02), por isso usa outro "dispositivo" (contexto sem cookies do aluno).

test.describe('aluno < 18: cadastro → bloqueado → consentimento → login', () => {
  test('o aluno fica bloqueado até o responsável autorizar e então entra', async ({ page, api, browser, baseURL }) => {
    const d = novoAluno('menor');
    await page.goto('/entrar');
    const apelido = await cadastrarPelaTela(page, d, { verificarAxe: true });

    // T05 "Falta pouco!": e-mail do responsável mascarado, apelido, prazo; E1 para o responsável e nenhum e-mail ao aluno.
    await expect(page.getByRole('heading', { level: 1, name: 'Falta pouco!' })).toBeVisible();
    await expect(page.getByText(/Enviamos um pedido de autorização para re\*\*\*@example\.test/)).toBeVisible();
    await expect(page.getByText(d.email)).toHaveCount(0);
    await expect(page.getByText(apelido, { exact: true })).toBeVisible();
    await axe(page);
    const e1 = await esperarEmail(api, d.email, 'E1');
    expect(e1.assunto).toContain(apelido);
    expect(e1.texto).not.toContain(d.senha);

    // Bloqueado (RQ-03): nem a rota do aluno, nem o login, nem recarregar a página passam da espera.
    await page.goto('/aluno');
    await expect(page).toHaveURL(/\/cadastro\/aguardando$/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Falta pouco!' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await entrar(page, apelido, d.senha);
    await expect(page).toHaveURL(/\/cadastro\/aguardando$/);

    // Sessão pendente tem escopo restrito (DC-01) e o aluno não se autoriza (DC-11, AB3).
    const comoAluno = (await page.request.get('/api/v1/me')).status();
    expect(comoAluno).toBe(200);
    const papel = await page.request.put('/api/v1/sessoes/atual/papel-ativo', { data: { papel: 'aluno' } });
    expect(papel.status()).toBe(403);
    const propria = await page.request.post('/api/v1/consentimentos/concessao', {
      headers: { 'idempotency-key': crypto.randomUUID() },
      data: { token: tokenDoLink(e1), nomeResponsavel: 'O Próprio Aluno', declaracao: true, aviso: AVISO.responsavel }
    });
    expect(propria.status()).toBe(403);
    expect((await propria.json()).error.code).toBe('FORBIDDEN');

    // T06: outro dispositivo (sem cookies do aluno) abre o link do e-mail.
    const ctxResp = await browser.newContext({ baseURL, extraHTTPHeaders: { 'cf-connecting-ip': ipAleatorio() } });
    const resp = await ctxResp.newPage();
    await resp.goto(caminhoDoLink(e1));
    await expect(resp.getByRole('heading', { level: 1, name: `${apelido} quer usar o Aprende+` })).toBeVisible();
    await expect(resp, 'o token sai da URL (RQ-32)').not.toHaveURL(/[?&#]t=/);
    await expect(resp.getByRole('heading', { level: 2, name: 'O que guardamos' })).toBeVisible();
    await expect(resp.getByRole('heading', { level: 2, name: 'O que NÃO fazemos' })).toBeVisible();
    // RQ-08/RQ-21: botões com o mesmo peso, "Autorizar" só habilita com nome + declaração, e não há ranking no Sprint 1.
    await expect(resp.getByRole('checkbox', { name: /ranking/i })).toHaveCount(0);
    const autorizar = resp.getByRole('button', { name: 'Autorizar', exact: true });
    const recusar = resp.getByRole('button', { name: 'Não autorizar' });
    await expect(autorizar).toBeDisabled();
    await expect(recusar).toBeEnabled();
    expect(await autorizar.evaluate((e) => e.className)).toBe(await recusar.evaluate((e) => e.className));
    await axe(resp);

    await resp.getByLabel('Seu nome').fill('Maria de Teste');
    await resp.getByRole('checkbox', { name: new RegExp(`Sou responsável por ${apelido}`) }).check();
    await expect(autorizar).toBeEnabled();
    await autorizar.click();
    await expect(resp.getByRole('heading', { level: 1, name: 'Tudo certo!' })).toBeVisible();
    await expect(resp.getByText(/Protocolo: [0-9A-Z]{26}/)).toBeVisible();
    await axe(resp);
    const e2 = await esperarEmail(api, d.email, 'E2');
    expect(new URL(e2.link).pathname).toBe('/responsavel/gerenciar');

    // Link de uso único: abrir de novo mostra "não funciona".
    await resp.goto(caminhoDoLink(e1));
    await expect(resp.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await axe(resp);
    await ctxResp.close();

    // Agora o aluno entra.
    await entrar(page, apelido, d.senha);
    await expect(page).toHaveURL(/\/aluno$/);
    await expect(page.getByRole('heading', { level: 1, name: `Oi, ${apelido}!` })).toBeVisible();
  });

  test('o responsável recusa: o cadastro é apagado e o aluno não entra', async ({ page, api, browser, baseURL }) => {
    const d = novoAluno('menor');
    const apelido = await cadastrarPelaTela(page, d);
    const e1 = await esperarEmail(api, d.email, 'E1');

    const ctx = await browser.newContext({ baseURL, extraHTTPHeaders: { 'cf-connecting-ip': ipAleatorio() } });
    const resp = await ctx.newPage();
    await resp.goto(caminhoDoLink(e1));
    await resp.getByRole('button', { name: 'Não autorizar' }).click();
    await expect(resp.getByRole('heading', { level: 1, name: 'Tudo bem.' })).toBeVisible();
    await expect(resp.getByText('Nenhum dado foi guardado.')).toBeVisible();
    await axe(resp);
    await resp.goto(caminhoDoLink(e1));
    await expect(resp.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await ctx.close();

    // RQ-05: pré-cadastro apagado. Nem a sessão antiga nem o login funcionam, e nada diz que a conta existiu.
    await page.goto('/aluno');
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.sessaoAcabou })).toBeVisible();
    await entrar(page, apelido, d.senha);
    await expect(page.getByText(TEXTO.loginInvalido)).toBeVisible();
    await axe(page);
  });

  test('corrigir o e-mail do responsável renova o link e invalida o anterior', async ({ page, api }) => {
    const d = novoAluno('menor');
    await cadastrarPelaTela(page, d);
    const antigo = caminhoDoLink(await esperarEmail(api, d.email, 'E1'));
    const certo = novoEmail('responsavel');

    await page.getByRole('button', { name: 'E-mail errado? Corrigir' }).click();
    await page.getByLabel('E-mail correto do responsável').fill(certo);
    await page.getByRole('button', { name: 'Enviar para este e-mail' }).click();
    await expect(page.getByText('E-mail corrigido.')).toBeVisible();
    const novo = caminhoDoLink(await esperarEmail(api, certo, 'E1'));

    await page.goto(antigo);
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await page.goto(novo);
    await expect(page.getByRole('heading', { level: 1, name: /quer usar o Aprende\+/ })).toBeVisible();
  });

  test('reenviar logo depois do envio é limitado (≤ 1 a cada 5 min, ≤ 3 por dia)', async ({ page, api }) => {
    const d = novoAluno('menor');
    await cadastrarPelaTela(page, d);
    await esperarEmail(api, d.email, 'E1');

    // corpo `{}`: o POST sem corpo que o navegador manda hoje leva 403 no `wrangler dev` (PEN-067, teste abaixo)
    const r = await page.request.post('/api/v1/cadastro/pendencia/reenvio', { data: {} });
    expect(r.status()).toBe(429);
    expect((await r.json()).error.code).toBe('RATE_LIMITED');
    expect(Number(r.headers()['retry-after'])).toBeGreaterThan(0);
  });

  test('T05: "Reenviar e-mail" pelo navegador mostra o aviso de espera (PEN-067)', async ({ page, api }) => {
    test.fail(true, 'PEN-067: POST sem corpo recebe 403 do CSRF; a SPA mostra "sem acesso" em vez de "espere um pouco"');
    const d = novoAluno('menor');
    await cadastrarPelaTela(page, d);
    await esperarEmail(api, d.email, 'E1');
    await page.getByRole('button', { name: 'Reenviar e-mail' }).click();
    await expect(page.getByText(TEXTO.esperePedirDeNovo)).toBeVisible({ timeout: 5_000 });
  });

  test('o mês em que completa 18 anos ainda é tratado como menor (idade ambígua)', async ({ page, api }) => {
    const hoje = new Date();
    const d: DadosAluno = {
      ...novoAluno('menor'),
      ano: String(hoje.getUTCFullYear() - 18),
      mes: String(hoje.getUTCMonth() + 1).padStart(2, '0'),
      anoEscolar: 'EM3'
    };
    await cadastrarPelaTela(page, d);
    await expect(page.getByRole('heading', { level: 1, name: 'Falta pouco!' })).toBeVisible();
    await esperarEmail(api, d.email, 'E1');
  });
});

test.describe('e-mail do responsável (RQ-04)', () => {
  test('o mesmo e-mail de responsável pode autorizar vários alunos (não é único)', async ({ api, novoCliente }) => {
    const email = novoEmail('responsavel');
    const apelidos: string[] = [];
    for (let i = 0; i < 2; i++) {
      const cli: Api = await novoCliente();
      const s = await cli.get('/cadastro/apelido-sugerido');
      const d = novoAluno('menor');
      const r = await cli.post('/cadastro/aluno', {
        apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email, senha: d.senha, aviso: AVISO.aluno
      });
      expect(r.status).toBe(201);
      expect(r.corpo.data.menor).toBe(true);
      apelidos.push(r.corpo.data.usuario.apelido);
    }
    await esperarEmail(api, email, 'E1', 2);
    expect(new Set(apelidos).size).toBe(2);
  });

  test('/me de menor não devolve e-mail nem nascimento (RQ-02, RQ-03)', async ({ novoCliente }) => {
    const cli = await novoCliente();
    const d = novoAluno('menor');
    const s = await cli.get('/cadastro/apelido-sugerido');
    const r = await cli.post('/cadastro/aluno', {
      apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email: d.email, senha: d.senha, aviso: AVISO.aluno
    });
    expect(r.status).toBe(201);
    // /me de menor não devolve e-mail nem nascimento (auth.yaml: `email` só para ≥18)
    const me = await cli.get('/me');
    expect(me.status).toBe(200);
    expect(me.corpo.data.email).toBeNull();
    expect(JSON.stringify(me.corpo)).not.toContain(d.email);
    expect(JSON.stringify(me.corpo)).not.toContain(`${d.ano}-${d.mes}`);
  });
});
