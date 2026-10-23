import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { db } from '../mocks/banco';
import { cadastrarAlunoPelaApi, entrarPelaApi, ultimoLink } from '../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../testes/renderizar';

describe('T13 · Início do aluno', () => {
  it('mostra saudação e cartões vazios, sem ranking nem pontuação, com data-etapa pelo ano escolar', async () => {
    await entrarPelaApi('LeaoAzul42', 'girafa-lunar-914');
    const { container } = renderizarApp('/aluno');
    expect(await screen.findByRole('heading', { level: 1, name: 'Oi, LeaoAzul42!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Suas atividades' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seu progresso' })).toBeInTheDocument();
    expect(screen.getByText('As primeiras atividades chegam em breve.')).toBeInTheDocument();
    expect(screen.queryByText(/ranking|pontos/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-etapa]')).toHaveAttribute('data-etapa', 'fund1'); // 5º ano
    await esperarSemViolacoes(container);
  });

  it('aluno do Ensino Médio usa a etapa "medio"', async () => {
    await entrarPelaApi('AguiaPrata77', 'trilha-segura-2026');
    renderizarApp('/aluno');
    await screen.findByRole('heading', { name: 'Oi, AguiaPrata77!' });
    expect(document.querySelector('[data-etapa]')).toHaveAttribute('data-etapa', 'medio');
  });

  it('menu: Privacidade abre o aviso; Sair encerra a sessão e volta ao login (sem "sessão acabou")', async () => {
    await entrarPelaApi('LeaoAzul42', 'girafa-lunar-914');
    const { usuario } = renderizarApp('/aluno');
    await usuario.click(await screen.findByRole('button', { name: /LeaoAzul42/ }));
    await usuario.click(screen.getByRole('button', { name: 'Privacidade' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Aviso de privacidade para estudantes' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendi' }));

    await usuario.click(screen.getByRole('button', { name: /LeaoAzul42/ }));
    await usuario.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(db().sessaoUsuarioId).toBeNull();
  });

  it('menu fecha com Esc e devolve o foco ao botão', async () => {
    await entrarPelaApi('LeaoAzul42', 'girafa-lunar-914');
    const { usuario } = renderizarApp('/aluno');
    const botao = await screen.findByRole('button', { name: /LeaoAzul42/ });
    await usuario.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    await usuario.keyboard('{Escape}');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveFocus();
  });

  it('sem sessão: "Sua sessão acabou." e o login retoma a rota pedida', async () => {
    const { usuario } = renderizarApp('/aluno');
    expect(await screen.findByRole('heading', { name: 'Sua sessão acabou.' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Entrar' }));
    await usuario.type(await screen.findByLabelText('Usuário ou e-mail'), 'LeaoAzul42');
    await usuario.type(screen.getByLabelText('Senha'), 'girafa-lunar-914');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Oi, LeaoAzul42!' })).toBeInTheDocument();
  });

  it('aluno não vê a área do professor: "Você não tem acesso a esta página."', async () => {
    await entrarPelaApi('LeaoAzul42', 'girafa-lunar-914');
    renderizarApp('/professor');
    expect(await screen.findByRole('heading', { name: 'Você não tem acesso a esta página.' })).toBeInTheDocument();
  });

  it('conta ainda pendente que tenta abrir a home volta à tela de espera', async () => {
    await cadastrarAlunoPelaApi();
    renderizarApp('/aluno');
    expect(await screen.findByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
    expect(ultimoLink('E1')).toBeTruthy();
  });

  it('rota desconhecida usa o mesmo texto de "sem acesso" (não revela o que existe)', async () => {
    renderizarApp('/admin/segredo');
    expect(await screen.findByRole('heading', { name: 'Você não tem acesso a esta página.' })).toBeInTheDocument();
  });
});

describe('T14 · Início do professor', () => {
  it('mostra nome, escola e e-mail, sem funções que ainda não existem', async () => {
    await entrarPelaApi('ana.professora@example.test', 'professora-ana-2026');
    const { container } = renderizarApp('/professor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Ana Souza (exemplo)' })).toBeInTheDocument();
    expect(screen.getByText('Escola Escola Municipal Exemplo')).toBeInTheDocument();
    expect(screen.getByText('ana.professora@example.test')).toBeInTheDocument();
    expect(screen.getByText('Papel: professor')).toBeInTheDocument();
    expect(screen.getByText(/Você ainda não tem turmas/)).toBeInTheDocument();
    expect(document.querySelector('[data-etapa]')).toHaveAttribute('data-etapa', 'neutra');
    await esperarSemViolacoes(container);
  });

  it('com dois papéis, o menu oferece "Trocar papel"', async () => {
    await entrarPelaApi('duplo.exemplo@example.test', 'duplo-exemplo-2026');
    const { usuario } = renderizarApp('/papel');
    await usuario.click(await screen.findByRole('button', { name: /Aluno/ }));
    await screen.findByRole('heading', { name: 'Oi, CoralVerde15!' });
    await usuario.click(screen.getByRole('button', { name: /CoralVerde15/ }));
    await usuario.click(screen.getByRole('button', { name: 'Trocar papel' }));
    expect(await screen.findByRole('heading', { name: 'Como você quer entrar?' })).toBeInTheDocument();
  });
});
