import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Alert, type AlertVariant } from './Alert';

describe('Alert', () => {
  it('erro usa role="alert"; os demais usam role="status"', () => {
    const casos: Array<[AlertVariant, string]> = [
      ['error', 'alert'],
      ['info', 'status'],
      ['success', 'status'],
      ['warning', 'status'],
    ];
    for (const [variante, papel] of casos) {
      const { unmount } = render(<Alert variant={variante}>Mensagem</Alert>);
      expect(screen.getByRole(papel)).toHaveClass(`am-alert--${variante}`);
      unmount();
    }
  });

  it('anuncia o tipo em texto (não só por cor/ícone)', () => {
    render(
      <Alert variant="error" title="Usuário ou senha incorretos.">
        Confira e tente de novo.
      </Alert>,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Erro: Usuário ou senha incorretos.');
    expect(alerta).toHaveTextContent('Confira e tente de novo.');
  });

  it('pode receber foco programático (resumo de erros)', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Alert ref={ref} variant="error" tabIndex={-1}>
        Corrija os campos abaixo.
      </Alert>,
    );
    ref.current?.focus();
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('permite trocar o role', () => {
    render(
      <Alert variant="success" role="alert">
        Reenviado!
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <>
        <Alert variant="info" title="Aviso">Texto</Alert>
        <Alert variant="error" title="Erro">
          <ul>
            <li>
              <a href="#email">Escreva um e-mail válido.</a>
            </li>
          </ul>
        </Alert>
      </>,
    );
    await esperarSemViolacoes(container);
  });
});
