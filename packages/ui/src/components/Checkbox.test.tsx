import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('marca e desmarca ao clicar no rótulo', async () => {
    const aoMudar = vi.fn();
    render(<Checkbox label="Li o aviso de privacidade" onChange={aoMudar} />);
    const caixa = screen.getByRole('checkbox', { name: 'Li o aviso de privacidade' });
    expect(caixa).not.toBeChecked();
    await userEvent.click(screen.getByText('Li o aviso de privacidade'));
    expect(caixa).toBeChecked();
    expect(aoMudar).toHaveBeenCalledOnce();
  });

  it('alterna com a barra de espaço', async () => {
    render(<Checkbox label="Aparecer no ranking" />);
    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('descreve com ajuda e erro e marca como inválido', () => {
    render(<Checkbox label="Autorizo" help="Obrigatório para continuar." error="Marque para continuar." />);
    const caixa = screen.getByRole('checkbox', { name: 'Autorizo' });
    expect(caixa).toHaveAttribute('aria-invalid', 'true');
    expect(caixa).toHaveAccessibleDescription('Obrigatório para continuar. Erro: Marque para continuar.');
  });

  it('desabilitado não muda', async () => {
    render(<Checkbox label="Bloqueado" disabled />);
    await userEvent.click(screen.getByText('Bloqueado'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('o rótulo pode conter um link', () => {
    render(<Checkbox label={<>Li o aviso. <a href="#aviso">Ler o aviso</a></>} />);
    expect(screen.getByRole('link', { name: 'Ler o aviso' })).toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(<Checkbox label="Autorizo" help="Ajuda" error="Erro" />);
    await esperarSemViolacoes(container);
  });
});
