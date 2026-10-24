import { expect, test } from './base';
import { TEXTO } from './constantes';
import {
  AVISO, axe, cadastrarAlunoPorApi, cadastrarPelaTela, caminhoDoLink, entrar, esperarEmail, novoAluno, sairPeloMenu, tokenDoLink
} from './apoio';

// Aluno com 18 anos ou mais (fluxos.md §4–5, T01–T05, T12–T13; RQ-03; SR-10, SR-12).

test.describe('aluno ≥ 18: cadastro → confirmação de e-mail → login', () => {
  test('percorre a jornada e só entra depois de confirmar o e-mail', async ({ page, api }) => {
    const d = novoAluno('maior');

    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar$/);
    await axe(page);
    await page.getByRole('link', { name: 'Criar conta de aluno' }).click();
    const apelido = await cadastrarPelaTela(page, d, { verificarAxe: true });

    // T05 "Confirme seu e-mail": e-mail mascarado (nunca inteiro) e apelido para entrar.
    await expect(page.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible();
    await expect(page.getByText(/al\*\*\*@example\.test/)).toBeVisible();
    await expect(page.getByText(d.email)).toHaveCount(0);
    await expect(page.getByText(apelido, { exact: true })).toBeVisible();
    await axe(page);

    // Bloqueado: a conta ainda é `pendente_email`. Rota da área logada volta para a espera.
    await page.goto('/aluno');
    await expect(page).toHaveURL(/\/cadastro\/aguardando$/);
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await entrar(page, apelido, d.senha);
    await expect(page).toHaveURL(/\/cadastro\/aguardando$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible();

    // E-mail E3 → T12.
    const e3 = await esperarEmail(api, d.email, 'E3');
    expect(e3.assunto).toBe('Confirme seu e-mail');
    await page.goto(caminhoDoLink(e3));
    await expect(page.getByRole('heading', { level: 1, name: 'E-mail confirmado' })).toBeVisible();
    await expect(page, 'o token sai da URL (RQ-32)').not.toHaveURL(/[?&#]t=/);
    await axe(page);

    // Login por apelido e, depois, por e-mail (maior usa o e-mail como login, DU-01).
    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await entrar(page, apelido, d.senha);
    await expect(page).toHaveURL(/\/aluno$/);
    await expect(page.getByRole('heading', { level: 1, name: `Oi, ${apelido}!` })).toBeVisible();
    await expect(page.getByText('As primeiras atividades chegam em breve.')).toBeVisible();
    await axe(page);

    // O efeito do logout no servidor (cookie antigo morre) tem teste próprio: 04, PEN-067.
    await sairPeloMenu(page, apelido);

    await entrar(page, d.email, d.senha);
    await expect(page).toHaveURL(/\/aluno$/);
  });

  test('o link de confirmação vale uma vez só', async ({ page, api }) => {
    const d = novoAluno('maior');
    await cadastrarAlunoPorApi(api, d);
    const link = caminhoDoLink(await esperarEmail(api, d.email, 'E3'));

    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1, name: 'E-mail confirmado' })).toBeVisible();
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await axe(page);
  });

  test('quem erra o e-mail corrige na espera e o link antigo deixa de valer', async ({ page, api }) => {
    const d = novoAluno('maior');
    const certo = novoAluno('maior').email;
    await cadastrarPelaTela(page, d);
    const antigo = caminhoDoLink(await esperarEmail(api, d.email, 'E3'));

    await page.getByRole('button', { name: 'E-mail errado? Corrigir' }).click();
    await page.getByLabel('E-mail correto').fill(certo);
    await page.getByRole('button', { name: 'Enviar para este e-mail' }).click();
    await expect(page.getByText('E-mail corrigido.')).toBeVisible();
    const novo = caminhoDoLink(await esperarEmail(api, certo, 'E3'));

    await page.goto(antigo);
    await expect(page.getByRole('heading', { level: 1, name: TEXTO.linkInvalido })).toBeVisible();
    await page.goto(novo);
    await expect(page.getByRole('heading', { level: 1, name: 'E-mail confirmado' })).toBeVisible();
  });
});

test.describe('cadastro: validação no servidor (SR-03, SR-10)', () => {
  async function tentar(api: import('./base').Api, extra: Record<string, unknown>, apelidoComoSenha = false) {
    const s = await api.get('/cadastro/apelido-sugerido');
    const d = novoAluno('maior');
    const r = await api.post('/cadastro/aluno', {
      apelidoToken: s.corpo.data.apelidoToken,
      nascimento: `${d.ano}-${d.mes}`,
      anoEscolar: d.anoEscolar,
      email: d.email,
      senha: apelidoComoSenha ? s.corpo.data.apelido : d.senha,
      aviso: AVISO.aluno,
      ...extra
    });
    return { r, d };
  }

  test('recusa senha comum, repetida e igual ao apelido, sem criar conta', async ({ api }) => {
    for (const [senha, codigo] of [['12345678', 'SENHA_COMUM'], ['aaaaaaaa', 'SENHA_COMUM'], ['curta', 'SENHA_CURTA']] as const) {
      const { r } = await tentar(api, { senha });
      expect(r.status, senha).toBe(400);
      expect(r.corpo.error.code).toBe('VALIDATION_ERROR');
      expect(r.corpo.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'senha', code: codigo })]));
    }
    const { r } = await tentar(api, {}, true);
    expect(r.status).toBe(400);
    expect(r.corpo.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'senha', code: 'SENHA_IGUAL_APELIDO' })]));
  });

  test('recusa nascimento no futuro, aviso desatualizado e campos que o cliente não pode mandar', async ({ api }) => {
    const futuro = `${new Date().getFullYear() + 1}-01`;
    const a = await tentar(api, { nascimento: futuro });
    expect(a.r.status).toBe(400);
    expect(a.r.corpo.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'nascimento', code: 'NASCIMENTO_INVALIDO' })]));

    const b = await tentar(api, { aviso: { versao: 'aluno-1999-01-v0' } });
    expect(b.r.status).toBe(400);
    expect(b.r.corpo.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'AVISO_DESATUALIZADO' })]));

    // SR-03: mass assignment → 400 e nada gravado (o login com a senha enviada não existe).
    for (const extra of [{ papel: 'admin' }, { status: 'ativa' }, { escolaId: '01JE2EES00000000000000000' }]) {
      const c = await tentar(api, extra);
      expect(c.r.status, JSON.stringify(extra)).toBe(400);
      expect(c.r.corpo.error.code).toBe('VALIDATION_ERROR');
      const login = await api.post('/sessoes', { identificador: c.d.email, senha: c.d.senha }, { chave: false });
      expect(login.status).toBe(401);
    }
  });

  test('o apelido não é digitável: token adulterado ou reaproveitado é recusado', async ({ api }) => {
    const s = await api.get('/cadastro/apelido-sugerido');
    const adulterado = (s.corpo.data.apelidoToken as string).replace(/.$/, (c: string) => (c === 'A' ? 'B' : 'A'));
    const a = await tentar(api, { apelidoToken: adulterado });
    expect(a.r.status).toBe(400);
    expect(a.r.corpo.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'apelidoToken', code: 'APELIDO_INVALIDO' })]));

    // reaproveitar o token de um apelido que já virou conta → 409 APELIDO_EM_USO (e a SPA sorteia outro)
    const ok = await tentar(api, { apelidoToken: s.corpo.data.apelidoToken });
    expect(ok.r.status).toBe(201);
    const repetido = await tentar(api, { apelidoToken: s.corpo.data.apelidoToken });
    expect(repetido.r.status).toBe(409);
    expect(repetido.r.corpo.error.details).toEqual([{ path: 'apelidoToken', code: 'APELIDO_EM_USO' }]);
    expect(tokenDoLink(await esperarEmail(api, ok.d.email, 'E3'))).toBeTruthy();
  });
});
