import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { FormField } from './FormField';
import { Input } from './Input';

describe('FormField', () => {
  it('liga o rótulo ao controle', () => {
    render(
      <FormField label="Seu apelido">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Seu apelido')).toBeInTheDocument();
  });

  it('mostra "obrigatório" e "opcional" em texto', () => {
    render(
      <>
        <FormField label="Nome" required>
          <Input />
        </FormField>
        <FormField label="Apelido" optional>
          <Input />
        </FormField>
      </>,
    );
    expect(screen.getByLabelText(/Nome/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
  });

  it('descreve o controle com ajuda e erro, e o marca como inválido', () => {
    render(
      <FormField label="E-mail" help="Só usamos para a autorização." error="Escreva um e-mail válido.">
        <Input />
      </FormField>,
    );
    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(
      'Só usamos para a autorização. Erro: Escreva um e-mail válido.',
    );
  });

  it('sem erro, o controle não é inválido', () => {
    render(
      <FormField label="E-mail">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid');
  });

  it('respeita o id informado', () => {
    render(
      <FormField label="Código" id="codigo">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Código')).toHaveAttribute('id', 'codigo');
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <FormField label="E-mail" help="Ajuda" error="Erro" required>
        <Input type="email" autoComplete="email" />
      </FormField>,
    );
    await esperarSemViolacoes(container);
  });
});
