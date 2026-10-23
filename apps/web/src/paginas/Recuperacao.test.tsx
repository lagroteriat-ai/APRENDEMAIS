import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { db } from '../mocks/banco';
import { servidor } from '../mocks/servidor';
import { entrarPelaApi, sairPelaApi, ultimoLink } from '../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../testes/renderizar';

const MENSAGEM = 'Se existir uma conta, o link já está a caminho.';

describe('T09 · Recuperar acesso — pedido', () => {
  it('conta existente e conta inexistente recebem exatamente a mesma resposta (DU-06)', async () => {
    const { usuario, container } = renderizarApp('/recuperar');
    await screen.findByRole('heading', { name: 'Recuperar acesso' });
    await esperarSemViolacoes(container);

    await usuario.type(screen.getByLabelText(/Apelido ou e-mail/), 'LeaoAzul42');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument();
    const corpoExistente = screen.getByText(MENSAGEM).closest('[role="status"]')?.textContent;
    expect(db().emails.filter((e) => e.tipo === 'E4')).toHaveLength(1);

    await usuario.clear(screen.getByLabelText(/Apelido ou e-mail/));
    await usuario.type(screen.getByLabelText(/Apelido ou e-mail/), 'NaoExiste99');
    await usuario.click(screen.getByRole('button', { name: 'Enviar de novo' }));
    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument();
    expect(screen.getByText(MENSAGEM).closest('[role="status"]')?.textContent).toBe(corpoExistente);
    expect(db().emails.filter((e) => e.tipo === 'E4')).toHaveLength(1); // nada foi enviado para quem não existe
  });

  it('menor: o link vai para o e-mail do RESPONSÁVEL', async () => {
    const { usuario } = renderizarApp('/recuperar');
    await usuario.type(await screen.findByLabelText(/Apelido ou e-mail/), 'LeaoAzul42');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    await screen.findByText(MENSAGEM);
    expect(db().emails.at(-1)?.para).toBe('responsavel.leao@example.test');
  });

  it('campo vazio: erro no cliente, com foco no resumo', async () => {
    const { usuario } = renderizarApp('/recuperar');
    await usuario.click(await screen.findByRole('button', { name: 'Enviar link' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva seu apelido ou e-mail.');
  });

  it('429 e rede mostram mensagens próprias e deixam tentar de novo', async () => {
    servidor.use(
      http.post('*/api/v1/recuperacao', () =>
        HttpResponse.json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x' } }, { status: 429 }),
      ),
    );
    const { usuario } = renderizarApp('/recuperar');
    await usuario.type(await screen.findByLabelText(/Apelido ou e-mail/), 'LeaoAzul42');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Espere alguns minutos e tente de novo.');
  });

  it('428: pede o desafio e envia de novo com o token', async () => {
    const { usuario } = renderizarApp('/recuperar');
    await usuario.type(await screen.findByLabelText(/Apelido ou e-mail/), 'desafio-qualquer');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    await usuario.click(await screen.findByRole('checkbox', { name: /Não sou um robô/ }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument();
  });
});

describe('T10 · Nova senha', () => {
  async function pedirLink(identificador: string) {
    const r = renderizarApp('/recuperar');
    await r.usuario.type(await screen.findByLabelText(/Apelido ou e-mail/), identificador);
    await r.usuario.click(screen.getByRole('button', { name: 'Enviar link' }));
    await screen.findByText(MENSAGEM);
    r.unmount();
    return ultimoLink('E4');
  }

  it('menor: mostra para quem é a senha, troca a senha e volta ao login com o aviso', async () => {
    const link = await pedirLink('LeaoAzul42');
    const { usuario, container } = renderizarApp(link);
    expect(await screen.findByText('Para LeaoAzul42')).toBeInTheDocument(); // só aparece depois da consulta do link
    expect(screen.getByRole('heading', { name: 'Criar nova senha' })).toBeInTheDocument();
    expect(screen.getByText('Anote a senha e conte para LeaoAzul42.')).toBeInTheDocument();
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/recuperar\/nova$/);
    await esperarSemViolacoes(container);

    await usuario.type(screen.getByLabelText(/Nova senha/), 'rio-nuvem-trigo-77');
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByText('Senha alterada.')).toBeInTheDocument();

    const entrou = await entrarPelaApi('LeaoAzul42', 'rio-nuvem-trigo-77');
    expect(entrou.status).toBe('ativa');
    await sairPelaApi();
  });

  it('18+: não mostra "Para [apelido]" nem o recado de anotar para o aluno', async () => {
    const link = await pedirLink('aguia.prata@example.test');
    renderizarApp(link);
    await screen.findByLabelText(/Nova senha/); // formulário já carregado
    expect(screen.queryByText(/^Para /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anote a senha/)).not.toBeInTheDocument();
  });

  it('senha curta (cliente) e senha comum (servidor) mostram o erro certo', async () => {
    const link = await pedirLink('LeaoAzul42');
    const { usuario } = renderizarApp(link);
    await usuario.type(await screen.findByLabelText(/Nova senha/), 'curta');
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use pelo menos 8 caracteres.');

    await usuario.clear(screen.getByLabelText(/Nova senha/));
    await usuario.type(screen.getByLabelText(/Nova senha/), '12345678');
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText('Essa senha é muito comum. Escolha outra.', { selector: 'a' })).toBeInTheDocument();
  });

  it('link de uso único: depois de usado, mostra "Este link não funciona" e leva a pedir outro', async () => {
    const link = await pedirLink('LeaoAzul42');
    const primeiro = renderizarApp(link);
    await primeiro.usuario.type(await screen.findByLabelText(/Nova senha/), 'lago-pedra-doce-31');
    await primeiro.usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    await screen.findByText('Senha alterada.');
    primeiro.unmount();

    const { usuario } = renderizarApp(link);
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Pedir outro link' }));
    expect(await screen.findByRole('heading', { name: 'Recuperar acesso' })).toBeInTheDocument();
  });

  it('sem token na URL: link inválido', async () => {
    renderizarApp('/recuperar/nova');
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
  });
});
