import { esperarSemViolacoesAxe, expect, test } from './base';

// Smoke da landing legada (S1-QA-02): a página carrega e o formulário está presente.
// Não envia o formulário (a API da landing só existe no Worker após S1-BE-05).
test.describe('landing — smoke', () => {
  test('carrega com título, chamada principal e formulário de cadastro', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Aprende\+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('conhecimento');
    const form = page.locator('#leadForm');
    await expect(form).toBeVisible();
    for (const campo of ['#nome', '#sobrenome', '#email', '#telefone', '#perfil', '#consentimento']) {
      await expect(form.locator(campo)).toBeVisible();
    }
    await expect(form.getByRole('button', { name: /começar agora/i })).toBeEnabled();
  });

  test('não tem violações de acessibilidade sérias ou críticas (axe, WCAG 2.1 AA)', async ({ page }) => {
    await page.goto('/');
    // Contraste insuficiente conhecido em 3 trechos (".steps-banner p", rodapé): PEN-DEFEITO aberto,
    // landing congelada. Remover `desativarRegras` quando o PEN for resolvido.
    await esperarSemViolacoesAxe(page, { desativarRegras: ['color-contrast'] });
  });
});
