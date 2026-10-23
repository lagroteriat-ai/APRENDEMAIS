// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gerarCss } from '../scripts/gerar-tokens.mjs';

const tokens = JSON.parse(readFileSync(new URL('../../../docs/ux/tokens.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8');

function cor(caminho: string): string {
  if (caminho.startsWith('#')) return caminho;
  let no = tokens.color;
  for (const parte of caminho.split('.')) no = no[parte];
  return typeof no === 'string' ? no : no.value;
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canais[0]! + 0.7152 * canais[1]! + 0.0722 * canais[2]!;
}

function razao(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior! + 0.05) / (menor! + 0.05);
}

describe('tokens.css', () => {
  it('está em sincronia com docs/ux/tokens.json (rode `pnpm --filter @aprendemais/ui tokens`)', () => {
    expect(css).toBe(gerarCss(tokens));
  });

  it('expõe as variáveis principais com o prefixo --am-', () => {
    for (const nome of [
      '--am-color-brand-blue: #0a55b7;',
      '--am-color-neutral-border: #7b8aa0;',
      '--am-color-feedback-error-solid: #b3261e;',
      '--am-space-scale-4: 1rem;',
      '--am-radius-md: 12px;',
      '--am-size-control-md: 44px;',
      '--am-focus-width: 3px;',
    ]) {
      expect(css).toContain(nome);
    }
  });

  it('define as variações por etapa de ensino', () => {
    expect(css).toMatch(/\[data-etapa="fund1"\] \{\s+--am-font-base: 1\.125rem;\s+--am-size-target-min: 48px;/);
  });
});

describe('contraste WCAG 2.2 AA dos pares aprovados em tokens.json', () => {
  for (const par of tokens.contraste.pares) {
    const minimo = String(par.ok).includes('1.4.11') ? 3 : 4.5;
    it(`${par.fg} sobre ${par.bg} ≥ ${minimo}:1`, () => {
      const calculada = razao(cor(par.fg), cor(par.bg));
      expect(calculada).toBeGreaterThanOrEqual(minimo);
      expect(Math.abs(calculada - par.razao)).toBeLessThan(0.05);
    });
  }

  for (const par of tokens.contraste.proibidos) {
    it(`proibido: ${par.fg} sobre ${par.bg} realmente reprova (< 3:1)`, () => {
      expect(razao(cor(par.fg), cor(par.bg))).toBeLessThan(3);
    });
  }
});
