import { expect, test } from './base';
import { axe, criarAlunoMaiorAtivo, novoAluno } from './apoio';
import { TEXTO } from './constantes';

// Acessibilidade além do axe estático das jornadas: celular (360 px), teclado, foco e diálogo (estratégia §6.5; principios.md).

test.describe('telas de acesso no celular (360 px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('sem rolagem horizontal e sem violações axe', async ({ page }) => {
    for (const rota of ['/entrar', '/cadastro', '/recuperar', '/responsavel/autorizar', '/sessao-expirada', '/rota-que-nao-existe']) {
      await page.goto(rota);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const [largura, janela] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(largura, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(janela);
      await axe(page);
    }
  });

  test('área do aluno também cabe na tela', async ({ page, api }) => {
    const aluno = await criarAlunoMaiorAtivo(api);
    await page.goto('/entrar');
    await page.getByLabel('Usuário ou e-mail').fill(aluno.apelido);
    await page.getByLabel('Senha', { exact: true }).fill(aluno.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Oi, ${aluno.apelido}!` })).toBeVisible();
    const [largura, janela] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(largura).toBeLessThanOrEqual(janela);
    await axe(page);
  });
});

test.describe('teclado e foco', () => {
  test('dá para entrar só com o teclado, e o foco vai para o resumo de erros quando falha', async ({ page, api }) => {
    const aluno = await criarAlunoMaiorAtivo(api);
    await page.goto('/entrar');
    await expect(page).toHaveTitle(/^Entrar · Aprende\+$/);

    async function digitarNoCampo(rotulo: string, texto: string) {
      for (let i = 0; i < 8; i++) {
        if (await page.getByLabel(rotulo, { exact: true }).evaluate((e) => e === document.activeElement)) break;
        await page.keyboard.press('Tab');
      }
      await expect(page.getByLabel(rotulo, { exact: true })).toBeFocused();
      await page.keyboard.type(texto);
    }

    await digitarNoCampo('Usuário ou e-mail', aluno.apelido);
    await digitarNoCampo('Senha', 'senha-errada-123');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText(TEXTO.loginInvalido);
    await expect(page.getByRole('alert'), 'o foco vai ao resumo de erros (fluxos.md T01)').toBeFocused();

    // refaz com a senha certa, ainda só com o teclado
    await page.getByLabel('Senha', { exact: true }).fill('');
    await page.getByLabel('Senha', { exact: true }).focus();
    await page.keyboard.type(aluno.senha);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/aluno$/);
    await expect(page, 'o título da aba acompanha a tela').toHaveTitle(`Oi, ${aluno.apelido}! · Aprende+`);
    await expect(page.getByRole('heading', { level: 1 }), 'o foco vai ao título da nova tela').toBeFocused();
  });

  test('cadastro: erro de campo vai ao resumo, com link que leva ao campo', async ({ page }) => {
    await page.goto('/cadastro');
    await expect(page.getByRole('heading', { level: 1, name: 'Sobre você' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click(); // sem preencher nada
    const resumo = page.getByRole('alert');
    await expect(resumo).toContainText('Há campos para corrigir.');
    await expect(resumo).toBeFocused();
    await axe(page);
    const link = resumo.getByRole('link').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByLabel('Mês'), 'o link do resumo leva o foco ao campo com erro').toBeFocused();
  });

  test('menu do usuário e diálogo do aviso: abrem, fecham com Esc e devolvem o foco', async ({ page }) => {
    const d = novoAluno('maior');
    await page.goto('/cadastro');
    await page.getByLabel('Mês').selectOption(d.mes);
    await page.getByLabel('Ano', { exact: true }).selectOption(d.ano);
    await page.getByLabel('Em que ano você estuda?').selectOption(d.anoEscolar);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('E-mail').fill(d.email);
    await page.getByRole('button', { name: 'Continuar' }).click();

    const abrir = page.getByRole('button', { name: 'Ler o aviso' });
    await abrir.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await axe(page);
    await page.keyboard.press('Tab');
    await expect(dialogo.locator(':focus'), 'o foco fica preso no diálogo').toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(abrir, 'o foco volta para quem abriu o diálogo').toBeFocused();
  });
});
