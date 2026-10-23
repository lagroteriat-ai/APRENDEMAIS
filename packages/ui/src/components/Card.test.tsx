import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { Card } from './Card';

describe('Card', () => {
  it('renderiza o título no nível pedido', () => {
    render(
      <Card title="Suas atividades" headingLevel={3}>
        As primeiras atividades chegam em breve.
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Suas atividades' })).toBeInTheDocument();
    expect(screen.getByText('As primeiras atividades chegam em breve.')).toBeInTheDocument();
  });

  it('em section, o título nomeia a região', () => {
    render(
      <Card as="section" title="Seu progresso">
        Vazio.
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Seu progresso' })).toBeInTheDocument();
  });

  it('renderiza o rodapé e o tom', () => {
    const { container } = render(
      <Card tone="tint" footer={<button type="button">Abrir</button>}>
        Conteúdo
      </Card>,
    );
    expect(container.firstElementChild).toHaveClass('am-card', 'am-card--tint');
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
  });

  it('funciona como item de lista', () => {
    render(
      <ul>
        <Card as="li" title="Aluno">
          Entrar como aluno
        </Card>
      </ul>,
    );
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <main>
        <h1>Início</h1>
        <Card as="article" title="Minhas turmas">
          Você ainda não tem turmas.
        </Card>
      </main>,
    );
    await esperarSemViolacoes(container);
  });
});
