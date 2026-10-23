import { axe } from 'jest-axe';
import { expect } from 'vitest';

/**
 * Falha se o axe achar violações de acessibilidade no trecho.
 * `color-contrast` fica de fora: jsdom não calcula estilos; o contraste dos tokens
 * é verificado em `tokens.test.ts`.
 */
export async function esperarSemViolacoes(container: Element) {
  const resultado = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  const resumo = resultado.violations.map((v) => `${v.id}: ${v.help}`);
  expect(resumo).toEqual([]);
}
