import { axe } from 'jest-axe';
import { expect } from 'vitest';

/**
 * Falha se o axe achar violações de acessibilidade no trecho (critério de aceite §6.5).
 * `color-contrast` fica de fora: jsdom não calcula estilos; contraste é coberto em
 * `packages/ui` (tokens) e no E2E com navegador real.
 */
export async function esperarSemViolacoes(container: Element) {
  const resultado = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  const resumo = resultado.violations.map((v) => `${v.id}: ${v.help}`);
  expect(resumo).toEqual([]);
}
