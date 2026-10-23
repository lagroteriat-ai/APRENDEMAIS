import AxeBuilder from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

/**
 * `test` do projeto: bloqueia toda requisição a hosts externos (Turnstile, fontes, analytics),
 * para o E2E ser hermético e nunca tocar serviços reais com dados de teste.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, usar) => {
    const origemLocal = new URL(baseURL ?? 'http://localhost').origin;
    await page.route('**/*', (rota) => {
      const url = rota.request().url();
      if (url.startsWith(origemLocal) || url.startsWith('data:') || url.startsWith('blob:')) return rota.continue();
      return rota.abort();
    });
    await usar(page);
  }
});

export { expect };

/** Falha com a lista de violações axe (WCAG 2.1 AA) de impacto sério/crítico (critério de aceite §6.5). */
export async function esperarSemViolacoesAxe(
  page: import('@playwright/test').Page,
  opcoes: { excluir?: string[]; desativarRegras?: string[] } = {}
) {
  let axe = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(opcoes.desativarRegras ?? []);
  for (const seletor of opcoes.excluir ?? []) axe = axe.exclude(seletor);
  const { violations } = await axe.analyze();
  const graves = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nó(s))`);
  expect(graves, 'violações de acessibilidade').toEqual([]);
}
