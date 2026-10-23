import { Button } from '@aprendemais/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fabricarLead } from '@aprendemais/test-utils';
import { esperarSemViolacoes } from './axe';

// Teste de INFRAESTRUTURA (S1-QA-02): jsdom + Testing Library + axe + fábricas funcionando.
// Testes de telas pertencem ao FE, ao lado do código (`src/<área>/<Nome>.test.tsx`); helpers em `src/testes/`.
describe('infra de testes da SPA (jsdom)', () => {
  it('renderiza um componente do @aprendemais/ui sem violações de acessibilidade', async () => {
    const { container } = render(<Button>Entrar</Button>);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    await esperarSemViolacoes(container);
  });

  it('usa dados sintéticos das fábricas de @aprendemais/test-utils', () => {
    expect(fabricarLead().email).toMatch(/@example\.test$/);
  });
});
