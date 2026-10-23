import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSemViolacoes } from '../test/axe';
import { AppShell, Container, Grid, Stack } from './Layout';

describe('Container', () => {
  it('aplica o tamanho e o elemento', () => {
    render(
      <Container size="form" as="section" aria-label="Formulário">
        x
      </Container>,
    );
    expect(screen.getByRole('region', { name: 'Formulário' })).toHaveClass('am-container', 'am-container--form');
  });

  it('o tamanho padrão não adiciona modificador', () => {
    const { container } = render(<Container>x</Container>);
    expect(container.firstElementChild).toHaveAttribute('class', 'am-container');
  });
});

describe('Stack', () => {
  it('define o espaçamento pela escala e a direção', () => {
    const { container } = render(
      <Stack gap={6} direction="row">
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const pilha = container.firstElementChild as HTMLElement;
    expect(pilha).toHaveClass('am-stack', 'am-stack--row');
    expect(pilha.style.getPropertyValue('--am-gap')).toBe('var(--am-space-scale-6)');
  });

  it('pode ser uma lista', () => {
    render(
      <Stack as="ul">
        <li>um</li>
      </Stack>,
    );
    expect(screen.getByRole('list')).toHaveClass('am-stack');
  });
});

describe('Grid', () => {
  it('expõe o número máximo de colunas (padrão 3)', () => {
    const { container, rerender } = render(<Grid>x</Grid>);
    expect(container.firstElementChild).toHaveAttribute('data-columns', '3');
    rerender(<Grid columns={2}>x</Grid>);
    expect(container.firstElementChild).toHaveAttribute('data-columns', '2');
  });
});

describe('AppShell', () => {
  it('tem landmarks, link de salto para o conteúdo e etapa neutra por padrão', () => {
    const { container } = render(
      <AppShell header={<span>Aprende+</span>} footer={<span>Rodapé</span>}>
        <h1>Entrar</h1>
      </AppShell>,
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Aprende+');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Entrar' }));
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Rodapé');
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
    expect(container.firstElementChild).toHaveAttribute('data-etapa', 'neutra');
  });

  it('aplica a etapa de ensino e permite trocar o id do main', () => {
    const { container } = render(
      <AppShell etapa="fund1" mainId="principal">
        <h1>Oi</h1>
      </AppShell>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-etapa', 'fund1');
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#principal');
  });

  it('omite header e footer quando não informados', () => {
    render(
      <AppShell>
        <h1>Oi</h1>
      </AppShell>,
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = render(
      <AppShell header={<nav aria-label="Principal"><a href="/">Início</a></nav>}>
        <Container>
          <h1>Início</h1>
          <Grid columns={2}>
            <div>a</div>
            <div>b</div>
          </Grid>
        </Container>
      </AppShell>,
    );
    await esperarSemViolacoes(container);
  });
});
