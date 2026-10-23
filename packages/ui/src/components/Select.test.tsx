import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { FormField } from './FormField';
import { Select } from './Select';

function Anos({ erro }: { erro?: string }) {
  return (
    <FormField label="Em que ano você estuda?" error={erro} required>
      <Select placeholder="Selecione" defaultValue="">
        <option value="5ef">5º ano</option>
        <option value="6ef">6º ano</option>
      </Select>
    </FormField>
  );
}

describe('Select', () => {
  it('mostra o placeholder como primeira opção sem valor', () => {
    render(<Anos />);
    const select = screen.getByLabelText(/Em que ano você estuda\?/);
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Selecione' })).toHaveValue('');
  });

  it('permite escolher uma opção por teclado/mouse', async () => {
    render(<Anos />);
    const select = screen.getByLabelText(/Em que ano você estuda\?/);
    await userEvent.selectOptions(select, '6ef');
    expect(select).toHaveValue('6ef');
  });

  it('herda obrigatoriedade e erro do FormField', () => {
    render(<Anos erro="Escolha o ano." />);
    const select = screen.getByLabelText(/Em que ano você estuda\?/);
    expect(select).toHaveAttribute('aria-required', 'true');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Erro: Escolha o ano.');
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(<Anos erro="Escolha o ano." />);
    await esperarSemViolacoes(container);
  });
});
