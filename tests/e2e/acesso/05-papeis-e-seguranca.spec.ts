import { LOCAL, CONVITE_PROFESSOR, EMAIL_PROFESSOR, NOME_PROFESSOR, SENHA_PROFESSOR, TEXTO } from './constantes';
import { expect, ipAleatorio, soLocal, test } from './base';
import {
  AVISO, apelidoInexistente, axe, cadastrarPelaTela, caminhoDoLink, criarAlunoMaiorAtivo, entrar, esperarEmail, novoAluno, sairPeloMenu, tokenFalso
} from './apoio';

// Acesso por papel (RQ-34, RQ-35; SR-01, SR-05, SR-19, SR-22) e verificações transversais do contrato (SR-03, SR-04, SR-16, SR-18, SR-21).

// A semente local traz um convite de professor de uso único (não há tela/CLI de convite no Sprint 1, DU-04).
// A primeira execução cria a conta; se o banco local foi reaproveitado, a conta já existe e o teste segue para o login.
test.describe.serial('professor e áreas por papel', () => {
  test('convite → cadastro → confirmação de e-mail → login → início do professor', async ({ page, api, novoCliente }) => {
    soLocal('o convite de professor vem da semente local');
    const cli = await novoCliente();
    const convite = await cli.post('/professores/convites/consulta', { token: CONVITE_PROFESSOR });
    if (convite.status === 200) {
      expect(convite.corpo.data).toMatchObject({ email: EMAIL_PROFESSOR, escola: { nome: 'Escola E2E' } });
      const cadastro = await cli.post('/professores', { token: CONVITE_PROFESSOR, nome: NOME_PROFESSOR, senha: SENHA_PROFESSOR, aviso: AVISO.professor });
      expect(cadastro.status).toBe(201);
      expect(cadastro.corpo.data.status).toBe('pendente_email');
      // sessão pendente: vê só a própria pendência (DC-01) e ainda não entra na área do professor
      expect((await cli.get('/me')).corpo.data).toMatchObject({ status: 'pendente_email', escopoSessao: 'pendente', papeis: [] });

      await page.goto(caminhoDoLink(await esperarEmail(api, EMAIL_PROFESSOR, 'E3')));
      await expect(page.getByRole('heading', { level: 1, name: 'E-mail confirmado' })).toBeVisible();

      // o convite é de uso único
      const reuso = await cli.post('/professores', { token: CONVITE_PROFESSOR, nome: 'Outra Pessoa', senha: SENHA_PROFESSOR, aviso: AVISO.professor });
      expect(reuso.status).toBe(400);
      expect(reuso.corpo.error.code).toBe('TOKEN_INVALIDO');
    }

    await entrar(page, EMAIL_PROFESSOR, SENHA_PROFESSOR);
    await expect(page).toHaveURL(/\/professor$/);
    await expect(page.getByRole('heading', { level: 1, name: `Olá, ${NOME_PROFESSOR}` })).toBeVisible();
    await expect(page.getByText('Escola Escola E2E')).toBeVisible();
    await expect(page.getByText('Papel: professor')).toBeVisible();
    await axe(page);
    await sairPeloMenu(page, NOME_PROFESSOR);
  });

  test('aluno não entra na área do professor, nem o professor na do aluno (403 e 404 com o mesmo texto)', async ({ page, api }) => {
    soLocal('depende do professor da semente local');
    const aluno = await criarAlunoMaiorAtivo(api);

    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page).toHaveURL(/\/aluno$/);
    await page.goto('/professor');
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.semAcesso })).toBeVisible();
    await axe(page);
    const inexistente = await page.goto('/area-que-nao-existe');
    expect(inexistente?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.semAcesso })).toBeVisible();

    await page.context().clearCookies();
    await entrar(page, EMAIL_PROFESSOR, SENHA_PROFESSOR);
    await expect(page).toHaveURL(/\/professor$/);
    await page.goto('/aluno');
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.semAcesso })).toBeVisible();
  });

  test('o papel vem do banco, nunca do cliente: trocar para papel que não se tem é 403 e cookie novo invalida o antigo', async ({ api, novoCliente, playwright, baseURL }) => {
    soLocal('cria aluno por e-mail confirmado na caixa de saída');
    const aluno = await criarAlunoMaiorAtivo(api);
    const cli = await novoCliente();
    const login = await cli.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false });
    expect(login.status).toBe(200);
    expect(login.corpo.data).toMatchObject({ status: 'ativa', escopoSessao: 'completa' });
    expect(login.corpo.data.me).toMatchObject({ papeis: ['aluno'], papelAtivo: 'aluno' });
    const sidAntigo = (await cli.cookieDeSessao())!;

    for (const papel of ['professor', 'gestor', 'admin', 'responsavel']) {
      const r = await cli.put('/sessoes/atual/papel-ativo', { papel }, { chave: false });
      expect(r.status, papel).toBe(403);
      expect(r.corpo.error.code).toBe('FORBIDDEN');
    }
    expect((await cli.put('/sessoes/atual/papel-ativo', { papel: 'super-usuario' }, { chave: false })).status).toBe(400);
    expect((await cli.put('/sessoes/atual/papel-ativo', { papel: 'aluno', isAdmin: true }, { chave: false })).status).toBe(400); // SR-03

    // papel válido: devolve cookie NOVO e o anterior morre (SR-05, DC-11)
    const troca = await cli.put('/sessoes/atual/papel-ativo', { papel: 'aluno' }, { chave: false });
    expect(troca.status).toBe(200);
    const sidNovo = (await cli.cookieDeSessao())!;
    expect(sidNovo).not.toBe(sidAntigo);

    const antigo = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `__Host-sid=${sidAntigo}`, 'cf-connecting-ip': ipAleatorio() } });
    expect((await antigo.get('/api/v1/me')).status()).toBe(401);
    // cookie extra "papel=admin" não muda nada: o papel não vem do cookie
    const comLixo = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `__Host-sid=${sidNovo}; papel=admin; role=admin`, 'cf-connecting-ip': ipAleatorio() } });
    const me = await comLixo.get('/api/v1/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).data.papeis).toEqual(['aluno']);
    await Promise.all([antigo.dispose(), comLixo.dispose()]);
  });
});

test.describe('rotas protegidas exigem sessão do tipo certo (SR-01, DC-01)', () => {
  test('sem cookie (ou com cookie forjado) toda rota de sessão responde 401', async ({ novoCliente, playwright, baseURL }) => {
    const cli = await novoCliente();
    const chamadas: [string, string, unknown?][] = [
      ['GET', '/me'],
      ['PUT', '/sessoes/atual/papel-ativo', { papel: 'aluno' }],
      ['POST', '/cadastro/pendencia/reenvio', {}], // corpo `{}`: sem corpo, o `wrangler dev` responde 403 antes da sessão (PEN-067)
      ['PUT', '/cadastro/pendencia/email', { email: 'x@example.test' }]
    ];
    const forjado = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `__Host-sid=${tokenFalso()}`, 'cf-connecting-ip': ipAleatorio() } });
    for (const [metodo, caminho, corpo] of chamadas) {
      const r = await cli.chamar(metodo, caminho, { corpo, chave: false });
      expect(r.status, `${metodo} ${caminho}`).toBe(401);
      expect(r.corpo.error.code).toBe('UNAUTHENTICATED');
      const f = await forjado.fetch(`/api/v1${caminho}`, { method: metodo, data: corpo, failOnStatusCode: false });
      expect(f.status(), `forjado ${metodo} ${caminho}`).toBe(401);
    }
    await forjado.dispose();
  });

  test('sessão pendente só alcança as rotas de pendência; sessão completa não alcança as de pendência', async ({ novoCliente, api }) => {
    const pendente = await novoCliente();
    const d = novoAluno('maior');
    const s = await pendente.get('/cadastro/apelido-sugerido');
    const cad = await pendente.post('/cadastro/aluno', {
      apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email: d.email, senha: d.senha, aviso: AVISO.aluno
    });
    expect(cad.status).toBe(201);

    expect((await pendente.get('/me')).status).toBe(200);
    const papel = await pendente.put('/sessoes/atual/papel-ativo', { papel: 'aluno' }, { chave: false });
    expect(papel.status).toBe(403);
    expect(papel.corpo.error.code).toBe('FORBIDDEN');

    // sessão completa em rota de pendência → 403
    const ativo = await criarAlunoMaiorAtivo(api);
    const completa = await novoCliente();
    await completa.post('/sessoes', { identificador: ativo.apelido, senha: ativo.senha }, { chave: false });
    const reenvio = await completa.post('/cadastro/pendencia/reenvio', {}, { chave: false });
    expect(reenvio.status).toBe(403);
  });
});

test.describe('contrato transversal da API', () => {
  test('SR-05/SR-07: cookie de sessão com atributos seguros, valor novo a cada login e prazos por perfil', async ({ api, novoCliente }) => {
    const aluno = await criarAlunoMaiorAtivo(api);
    const cli = await novoCliente();
    const um = await cli.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false });
    const cookie = um.cookies.find((c) => c.startsWith('__Host-sid='))!;
    expect(cookie, 'Set-Cookie do login').toBeTruthy();
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\//i);
    expect(cookie, 'cookie __Host- não pode ter Domain').not.toMatch(/Domain=/i);
    const valor = cookie.slice('__Host-sid='.length, cookie.indexOf(';'));
    expect(valor.length, '≥ 256 bits em base64url').toBeGreaterThanOrEqual(43);
    // aluno: 30 d absolutos (SR-07)
    expect(Number(/Max-Age=(\d+)/i.exec(cookie)![1])).toBeGreaterThan(29 * 86400);
    expect(Number(/Max-Age=(\d+)/i.exec(cookie)![1])).toBeLessThanOrEqual(30 * 86400);

    const dois = await cli.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false });
    const valor2 = dois.cookies.find((c) => c.startsWith('__Host-sid='))!.split(';')[0]!.slice('__Host-sid='.length);
    expect(valor2, 'valor novo após login').not.toBe(valor);
    expect((await cli.get('/me')).status).toBe(200);
  });

  test('SR-19/SR-16: toda resposta traz no-store e X-Request-Id; erros não vazam detalhe interno', async ({ novoCliente }) => {
    const cli = await novoCliente();
    const respostas = [
      await cli.get('/avisos-privacidade/vigentes'),
      await cli.get('/me'),
      await cli.get('/rota-que-nao-existe'),
      await cli.post('/sessoes', undefined, { bruto: '{isto não é json', chave: false }),
      await cli.post('/sessoes', { identificador: 'x' }, { chave: false }),
      await cli.post('/sessoes', { identificador: apelidoInexistente(), senha: 'senha-errada-1' }, { chave: false })
    ];
    expect(respostas.map((r) => r.status)).toEqual([200, 401, 404, 400, 400, 401]);
    for (const r of respostas) {
      expect(r.headers['cache-control']).toContain('no-store');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-request-id']).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      if (r.status >= 400) {
        expect(r.corpo).toMatchObject({ ok: false, error: { code: expect.any(String), message: expect.any(String) } });
        expect(JSON.stringify(r.corpo)).not.toMatch(/stack|SQLITE|SELECT |INSERT |D1_|TypeError|ReferenceError|\.ts:\d|at [\w.]+ \(/i);
      }
    }
  });

  test('SR-04: origem estranha ou corpo que não é JSON são recusados (403) sem efeito', async ({ novoCliente }) => {
    soLocal('o cabeçalho Origin da requisição é controlado pelo teste; em staging vale a allowlist do ambiente');
    const cli = await novoCliente();
    const corpo = { identificador: apelidoInexistente(), senha: 'senha-errada-1' };
    const estranha = await cli.post('/sessoes', corpo, { headers: { origin: 'https://evil.example' }, chave: false });
    expect(estranha.status).toBe(403);
    expect(estranha.corpo.error.code).toBe('FORBIDDEN');
    const texto = await cli.post('/sessoes', undefined, { bruto: JSON.stringify(corpo), headers: { 'content-type': 'text/plain' }, chave: false });
    expect(texto.status).toBe(403);
    const formulario = await cli.post('/sessoes', undefined, { bruto: 'identificador=a&senha=b', headers: { 'content-type': 'application/x-www-form-urlencoded' }, chave: false });
    expect(formulario.status).toBe(403);
    // a mesma chamada, com a origem da própria SPA, chega à regra de negócio (401)
    const propria = await cli.post('/sessoes', corpo, { headers: { origin: process.env.E2E_BASE_URL ?? 'http://localhost:4173' }, chave: false });
    expect(propria.status).toBe(401);
  });

  test('SR-19: a SPA não guarda dados pessoais no navegador (storage) durante cadastro e login', async ({ page }) => {
    const d = novoAluno('maior');
    const apelido = await cadastrarPelaTela(page, d);
    await entrar(page, apelido, d.senha); // pendente: vai à espera
    const guardado = await page.evaluate(async () => {
      const bancos = (await indexedDB.databases?.()) ?? [];
      return JSON.stringify({
        local: { ...localStorage }, sessao: { ...sessionStorage }, bancos: bancos.map((b) => b.name), cookies: document.cookie
      });
    });
    for (const dado of [d.email, d.senha, apelido, `${d.ano}-${d.mes}`, d.email.split('@')[0]!]) {
      expect(guardado, `armazenamento não deve conter "${dado}"`).not.toContain(dado);
    }
    expect(guardado, 'o cookie de sessão é HttpOnly (invisível ao JavaScript)').not.toContain('__Host-sid');
  });
});

test.describe('o que a SPA publica (SR-18, SR-21)', () => {
  test('SR-21: documentos internos e arquivos de configuração não são servidos', async ({ request }) => {
    for (const caminho of ['/docs/seguranca/threat-model.md', '/DECISOES.md', '/wrangler.toml', '/apps/api/wrangler.toml', '/db/migrations/0001_municipios_escolas.sql', '/.dev.vars', '/schema.sql']) {
      const r = await request.get(caminho);
      const corpo = await r.text();
      expect(corpo, caminho).not.toMatch(/Threat model|ADR-00|COLOQUE_|\[\[d1_databases\]\]|CREATE TABLE|IP_HASH_SECRET/);
      // a SPA responde index.html a caminhos desconhecidos (PEN-026): 404 ou HTML, nunca o arquivo
      if (r.status() === 200) expect(r.headers()['content-type'], caminho).toContain('text/html');
    }
  });

  test('SR-18: cabeçalhos de segurança da SPA (CSP sem inline/eval, nosniff, frame-ancestors, Referrer-Policy, HSTS)', async ({ request }) => {
    test.skip(LOCAL, 'os cabeçalhos são do Worker da SPA em preview/staging; o `vite preview` local não os envia');
    const h = (await request.get('/')).headers();
    const csp = h['content-security-policy'] ?? '';
    expect(csp, 'Content-Security-Policy').not.toBe('');
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['strict-transport-security']).toBeTruthy();
  });
});
