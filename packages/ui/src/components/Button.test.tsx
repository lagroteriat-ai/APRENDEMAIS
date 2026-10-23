import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Button } from './Button';

describe('Button', () => {
  it('usa type="button" por padrão e aceita type="submit"', () => {
    render(
      <>
        <Button>Salvar</Button>
        <Button type="submit">Enviar</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit');
  });

  it('chama onClick e aplica variante e tamanho', async () => {
    const aoClicar = vi.fn();
    render(
      <Button variant="danger" size="lg" fullWidth onClick={aoClicar}>
        Retirar
      </Button>,
    );
    const botao = screen.getByRole('button', { name: 'Retirar' });
    await userEvent.click(botao);
    expect(aoClicar).toHaveBeenCalledOnce();
    expect(botao).toHaveClass('am-btn', 'am-btn--danger', 'am-btn--lg', 'am-btn--full');
  });

  it('em loading: troca o texto, anuncia ocupado, mantém o foco e ignora cliques', async () => {
    const aoClicar = vi.fn();
    render(
      <Button loading loadingText="Entrando…" onClick={aoClicar}>
        Entrar
      </Button>,
    );
    const botao = screen.getByRole('button', { name: 'Entrando…' });
    expect(botao).toHaveAttribute('aria-busy', 'true');
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    expect(botao).not.toBeDisabled();
    botao.focus();
    await userEvent.click(botao);
    expect(aoClicar).not.toHaveBeenCalled();
    expect(botao).toHaveFocus();
  });

  it('desabilitado não dispara onClick', async () => {
    const aoClicar = vi.fn();
    render(
      <Button disabled onClick={aoClicar}>
        Autorizar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('é operável por teclado', async () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Continuar</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <>
        <Button>Primário</Button>
        <Button variant="secondary" loading>
          Carregando
        </Button>
        <Button variant="link" disabled>
          Link
        </Button>
      </>,
    );
    await esperarSemViolacoes(container);
  });
});
