import { expect, soLocal, test } from './base';
import { TEXTO } from './constantes';
import {
  AVISO, apelidoInexistente, axe, cadastrarPelaTela, criarAlunoMaiorAtivo, criarAlunoMenorAtivo, entrar, esperarEmail, esperarSemEmail, listarEmails, novoAluno,
  novoEmail, tokenFalso
} from './apoio';

// Enumeração de usuários e limites de abuso (AB1, AB2, AB7; DU-06, DC-05, DC-06; SR-08, SR-09, SR-13).
// Os limites são por IP: cada teste usa um IP próprio (cabeçalho CF-Connecting-IP). Em staging a Cloudflare sobrescreve
// esse cabeçalho, então o que depende de IP forjado é "só local".

const formato = (o: unknown): unknown =>
  o !== null && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, formato(v)])) : typeof o;

test.describe('login: conta existente × inexistente (AB1, DU-06)', () => {
  test('a tela mostra a mesma mensagem, e o foco vai para o resumo de erros', async ({ page, api }) => {
    const aluno = await criarAlunoMaiorAtivo(api);

    await entrar(page, aluno.apelido, 'senha-errada-123');
    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText(TEXTO.loginInvalido);
    await axe(page);
    const existente = (await alerta.innerText()).replace(/Código para o suporte:.*/s, '').trim();

    await entrar(page, `Inexistente${Math.floor(Math.random() * 900) + 100}`, 'senha-errada-123');
    await expect(page.getByRole('alert')).toContainText(TEXTO.loginInvalido);
    const inexistente = (await page.getByRole('alert').innerText()).replace(/Código para o suporte:.*/s, '').trim();
    expect(inexistente).toBe(existente);
  });

  test('a API devolve o mesmo status e corpo para apelido, e-mail, conta pendente e conta que não existe', async ({ api, novoCliente }) => {
    const ativo = await criarAlunoMaiorAtivo(api);

    const alvos = [ativo.apelido, ativo.email, ativo.apelido.toUpperCase(), apelidoInexistente(), novoEmail('ninguem')];
    for (const identificador of alvos) {
      const r = await (await novoCliente()).post('/sessoes', { identificador, senha: 'senha-errada-123' }, { chave: false });
      expect(r.status, identificador).toBe(401);
      expect(r.corpo, identificador).toEqual({ ok: false, error: { code: 'UNAUTHENTICATED', message: TEXTO.loginInvalido } });
    }
  });

  test('conta pendente com senha errada não revela que existe nem seu estado (só depois da senha certa)', async ({ api, novoCliente }) => {
    const d = novoAluno('menor');
    const s = await api.get('/cadastro/apelido-sugerido');
    const cad = await api.post('/cadastro/aluno', {
      apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email: d.email, senha: d.senha, aviso: AVISO.aluno
    });
    expect(cad.status).toBe(201);
    const apelido = cad.corpo.data.usuario.apelido as string;

    const errada = await (await novoCliente()).post('/sessoes', { identificador: apelido, senha: 'senha-errada-123' }, { chave: false });
    const inexistente = await (await novoCliente()).post('/sessoes', { identificador: apelidoInexistente(), senha: 'senha-errada-123' }, { chave: false });
    expect(errada.status).toBe(inexistente.status);
    expect(errada.corpo).toEqual(inexistente.corpo);

    const certa = await (await novoCliente()).post('/sessoes', { identificador: apelido, senha: d.senha }, { chave: false });
    expect(certa.status).toBe(200);
    expect(certa.corpo.data).toMatchObject({ status: 'pendente_responsavel', escopoSessao: 'pendente' });
  });
});

test.describe('recuperação de acesso não revela a conta (SR-08, DU-06)', () => {
  test('mesma resposta e mesma tela para conta existente e inexistente; só a existente recebe e-mail', async ({ page, api, novoCliente }) => {
    const aluno = await criarAlunoMaiorAtivo(api);

    const emailFantasma = novoEmail('ninguem');
    const a = await (await novoCliente()).post('/recuperacao', { identificador: aluno.apelido }, { chave: false });
    const b = await (await novoCliente()).post('/recuperacao', { identificador: apelidoInexistente() }, { chave: false });
    const c = await (await novoCliente()).post('/recuperacao', { identificador: emailFantasma }, { chave: false });
    for (const r of [a, b, c]) {
      expect(r.status).toBe(202);
      expect(r.corpo).toEqual({ ok: true, data: {} });
    }
    await esperarEmail(api, aluno.email, 'E4');
    await esperarSemEmail(api, emailFantasma, 'E4');

    // pela tela: o texto é o mesmo para quem existe e para quem não existe
    const textos: string[] = [];
    for (const identificador of [aluno.email, novoEmail('fantasma')]) {
      await page.goto('/recuperar');
      await page.getByLabel('Apelido ou e-mail').fill(identificador);
      await page.getByRole('button', { name: /Enviar/ }).click();
      await expect(page.getByText('Se existir uma conta, o link já está a caminho.')).toBeVisible();
      textos.push(await page.locator('main').innerText());
    }
    expect(textos[0]!.replace(/\s+/g, ' ')).toBe(textos[1]!.replace(/\s+/g, ' '));
    await axe(page);
  });

  test('conta de menor: o link vai ao responsável, nunca a um endereço informado na hora', async ({ api, novoCliente }) => {
    const aluno = await criarAlunoMenorAtivo(api, await novoCliente());
    await (await novoCliente()).post('/recuperacao', { identificador: aluno.apelido }, { chave: false });
    const e4 = await esperarEmail(api, aluno.email, 'E4');
    expect(e4.para).toBe(aluno.email); // aluno menor não tem e-mail próprio: o endereço é o do responsável (DU-03)
    expect(e4.assunto).not.toContain(aluno.senha);
  });

  test('limite por conta: depois de 3 pedidos na hora o 4º é barrado — igual para conta que existe e que não existe', async ({ api, novoCliente }) => {
    soLocal('o limite por conta dura 1 h; em staging o teste deixaria a conta bloqueada');
    const existente = await criarAlunoMaiorAtivo(api);
    for (const identificador of [existente.apelido, apelidoInexistente()]) {
      const cli = await novoCliente();
      const status = [];
      for (let i = 0; i < 4; i++) status.push((await cli.post('/recuperacao', { identificador }, { chave: false })).status);
      expect(status, identificador).toEqual([202, 202, 202, 429]);
    }
  });
});

test.describe('cadastro não revela e-mail já cadastrado (DC-05, AB1)', () => {
  test('quem tenta cadastrar o e-mail de outra pessoa vê o mesmo "confirme seu e-mail"; o dono é avisado e nada muda', async ({ page, api, novoCliente }) => {
    const dono = await criarAlunoMaiorAtivo(api);
    const estranho = { ...novoAluno('maior'), email: dono.email };

    const apelidoIsca = await cadastrarPelaTela(page, estranho);
    await expect(page.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible();
    await expect(page.getByText(/Enviamos um link para confirmar seu e-mail, al\*\*\*@example\.test/)).toBeVisible();
    await expect(page.getByText(apelidoIsca, { exact: true })).toBeVisible();
    await axe(page);

    // o dono recebe o aviso "você já tem conta" (E6) com o caminho de recuperação, e nenhum novo link de confirmação
    const e6 = await esperarEmail(api, dono.email, 'E6');
    expect(new URL(e6.link).pathname).toBe('/recuperar');
    expect((await listarEmails(api, dono.email)).filter((e) => e.tipo === 'E3')).toHaveLength(1);

    // "Reenviar" na sessão isca parece funcionar (202), mas não manda nada nem mexe na conta do dono.
    // Corpo `{}`: o POST sem corpo que o botão manda hoje leva 403 no `wrangler dev` (PEN-067).
    const reenvio = await page.request.post('/api/v1/cadastro/pendencia/reenvio', { data: {} });
    expect(reenvio.status()).toBe(202);
    expect((await listarEmails(api, dono.email)).filter((e) => e.tipo === 'E3')).toHaveLength(1);

    // a conta isca não existe: o apelido sorteado não loga, a senha do estranho não loga na conta do dono
    const cli = await novoCliente();
    expect((await cli.post('/sessoes', { identificador: apelidoIsca, senha: estranho.senha }, { chave: false })).status).toBe(401);
    expect((await cli.post('/sessoes', { identificador: dono.email, senha: estranho.senha }, { chave: false })).status).toBe(401);
    expect((await cli.post('/sessoes', { identificador: dono.email, senha: dono.senha }, { chave: false })).status).toBe(200);
  });

  test('a resposta do cadastro tem o mesmo formato com e-mail novo e com e-mail já usado', async ({ api, novoCliente }) => {
    const dono = await criarAlunoMaiorAtivo(api);
    async function cadastrar(email: string) {
      const cli = await novoCliente();
      const d = novoAluno('maior');
      const s = await cli.get('/cadastro/apelido-sugerido');
      return cli.post('/cadastro/aluno', {
        apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email, senha: d.senha, aviso: AVISO.aluno
      });
    }
    const novo = await cadastrar(novoEmail('aluno'));
    const repetido = await cadastrar(dono.email);
    expect(repetido.status).toBe(novo.status);
    expect(formato(repetido.corpo)).toEqual(formato(novo.corpo));
    expect(repetido.cookies.some((c) => c.startsWith('__Host-sid='))).toBe(true);
    expect(novo.cookies.some((c) => c.startsWith('__Host-sid='))).toBe(true);
    expect(repetido.corpo.data.pendencia.emailMascarado).toMatch(/^al\*\*\*@example\.test$/);
  });
});

// F-01 (login em paralelo) e o SR-08 de tempo ficam em `08-tempo-e-concorrencia.isolado.spec.ts`: dependem de o servidor estar ocioso.
test.describe('achados da revisão de segurança, reproduzidos em execução (S1-SEG-04)', () => {
  // Falha esperada até a correção: ao corrigir, o Playwright acusa "esperava falhar e passou" → remover o `test.fail`.
  test('F-03 (PEN-053): o reenvio logo após o cadastro responde igual com e-mail novo e com e-mail já cadastrado', async ({ api, novoCliente }) => {
    test.fail(true, 'PEN-053: e-mail novo → 429 (já houve envio); e-mail existente (sessão isca) → 202; vira oráculo de e-mail cadastrado');
    const dono = await criarAlunoMaiorAtivo(api);
    async function reenviarLogoApos(email: string) {
      const cli = await novoCliente();
      const d = novoAluno('maior');
      const s = await cli.get('/cadastro/apelido-sugerido');
      const cad = await cli.post('/cadastro/aluno', {
        apelidoToken: s.corpo.data.apelidoToken, nascimento: `${d.ano}-${d.mes}`, anoEscolar: d.anoEscolar, email, senha: d.senha, aviso: AVISO.aluno
      });
      expect(cad.status).toBe(201);
      return cli.post('/cadastro/pendencia/reenvio', {}, { chave: false });
    }
    const novo = await reenviarLogoApos(novoEmail('aluno'));
    const existente = await reenviarLogoApos(dono.email);
    expect(existente.status, `e-mail novo → ${novo.status}; e-mail existente → ${existente.status}`).toBe(novo.status);
  });
});

test.describe('limites de abuso (AB2, AB7, DC-06, SR-09, SR-13)', () => {
  test('SR-09 (por IP): a 4ª tentativa de login exige desafio — inclusive com a senha certa', async ({ page, api }) => {
    soLocal('usa o IP forjado do teste como "IP do aluno"');
    const aluno = await criarAlunoMaiorAtivo(api);
    const status: number[] = [];
    for (let i = 0; i < 3; i++) status.push((await api.post('/sessoes', { identificador: aluno.apelido, senha: 'senha-errada-123' }, { chave: false })).status);
    expect(status).toEqual([401, 401, 401]);
    const quarta = await api.post('/sessoes', { identificador: aluno.apelido, senha: aluno.senha }, { chave: false });
    expect(quarta.status).toBe(428);
    expect(quarta.corpo.error.code).toBe('DESAFIO_REQUERIDO');
    // sem site key do Turnstile no ambiente, o aluno fica sem como passar (PEN-045): a tela avisa em vez de travar em silêncio
    await entrar(page, aluno.apelido, aluno.senha);
    await expect(page.getByText('Confirme que você não é um robô para continuar.')).toBeVisible();
    await axe(page);
  });

  test('SR-09 (por conta): 3 falhas vindas de IPs diferentes também exigem desafio para a conta', async ({ novoCliente }) => {
    soLocal('usa IPs forjados');
    const identificador = `alvo${Math.random().toString(36).slice(2, 8)}`;
    for (let i = 0; i < 3; i++) {
      const r = await (await novoCliente()).post('/sessoes', { identificador, senha: 'senha-errada-123' }, { chave: false });
      expect(r.status).toBe(401);
    }
    const quarta = await (await novoCliente()).post('/sessoes', { identificador, senha: 'senha-errada-123' }, { chave: false });
    expect(quarta.status).toBe(428);
  });

  test('SR-13: "Sortear outro" passa de 10 por IP em 10 min → 429 com Retry-After', async ({ novoCliente }) => {
    soLocal('usa IP forjado');
    const cli = await novoCliente();
    const status: number[] = [];
    let ultima;
    for (let i = 0; i < 11; i++) {
      ultima = await cli.get('/cadastro/apelido-sugerido');
      status.push(ultima.status);
    }
    expect(status).toEqual([...Array<number>(10).fill(200), 429]);
    expect(ultima!.corpo.error.code).toBe('RATE_LIMITED');
    expect(Number(ultima!.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('tentativas de adivinhar link: depois de 60 em 10 min, o IP é barrado (429)', async ({ novoCliente }) => {
    soLocal('usa IP forjado');
    const cli = await novoCliente();
    let ultima;
    const status = new Set<number>();
    for (let i = 0; i < 62; i++) {
      ultima = await cli.post('/email/confirmacao', { token: tokenFalso() }, { chave: false });
      status.add(ultima.status);
    }
    expect([...status].sort()).toEqual([400, 429]);
    expect(ultima!.status).toBe(429);
  });
});
