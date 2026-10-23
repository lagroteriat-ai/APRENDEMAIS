import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Button } from './Button';
import { FormField } from './FormField';
import { Input } from './Input';

describe('Input', () => {
  it('aceita digitação e repassa a ref', async () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Apelido" />);
    await userEvent.type(screen.getByLabelText('Apelido'), 'LeaoAzul42');
    expect(ref.current).toHaveValue('LeaoAzul42');
  });

  it('é type="text" por padrão e aceita type e autoComplete', () => {
    render(
      <>
        <Input aria-label="Usuário" />
        <Input aria-label="Senha" type="password" autoComplete="current-password" />
      </>,
    );
    expect(screen.getByLabelText('Usuário')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('invalid marca aria-invalid mesmo fora de um FormField', () => {
    render(<Input aria-label="Nome" invalid />);
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });

  it('junta aria-describedby próprio com o do FormField', () => {
    render(
      <FormField label="Senha" help="Mínimo de 8 caracteres.">
        <Input aria-describedby="dica-extra" />
      </FormField>,
    );
    const campo = screen.getByLabelText('Senha');
    expect(campo.getAttribute('aria-describedby')).toMatch(/-ajuda dica-extra$/);
  });

  it('renderiza a ação ao lado (ex.: Mostrar senha)', async () => {
    render(
      <FormField label="Senha">
        <Input type="password" endAction={<Button variant="secondary">Mostrar</Button>} />
      </FormField>,
    );
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByLabelText('Senha')).toHaveFocus();
  });

  it('desabilitado não recebe digitação', async () => {
    render(<Input aria-label="Fixo" disabled defaultValue="prof@escola.pe.gov.br" />);
    await userEvent.type(screen.getByLabelText('Fixo'), 'x');
    expect(screen.getByLabelText('Fixo')).toHaveValue('prof@escola.pe.gov.br');
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <FormField label="Senha" error="Muito curta.">
        <Input type="password" autoComplete="new-password" endAction={<Button>Mostrar</Button>} />
      </FormField>,
    );
    await esperarSemViolacoes(container);
  });
});
