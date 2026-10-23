import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { servidor } from '../mocks/servidor';
import { cadastrarAlunoPelaApi, sairPelaApi } from '../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../testes/renderizar';

async function preencher(usuario: ReturnType<typeof renderizarApp>['usuario'], quem: string, senha: string) {
  if (quem) await usuario.type(screen.getByLabelText('Usuário ou e-mail'), quem);
  if (senha) await usuario.type(screen.getByLabelText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('T01 · Entrar', () => {
  it('a raiz leva a /entrar e mostra o formulário acessível', async () => {
    const { container } = renderizarApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuário ou e-mail')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar conta de aluno' })).toBeInTheDocument();
    await esperarSemViolacoes(container);
  });

  it('campos vazios: resumo de erros com foco e links para os campos (sem chamar a API)', async () => {
    let chamadas = 0;
    servidor.use(http.post('*/api/v1/sessoes', () => (chamadas++, HttpResponse.json({}, { status: 500 }))));
    const { usuario } = renderizarApp('/entrar');
    await usuario.click(await screen.findByRole('button', { name: 'Entrar' }));

    const resumo = screen.getByRole('alert');
    expect(resumo).toHaveFocus();
    expect(resumo).toHaveTextContent('Escreva seu apelido ou e-mail.');
    expect(resumo).toHaveTextContent('Escreva sua senha.');
    await usuario.click(screen.getByRole('link', { name: 'Escreva seu apelido ou e-mail.' }));
    expect(screen.getByLabelText(/Usuário ou e-mail/)).toHaveFocus();
    expect(chamadas).toBe(0);
  });

  it('credenciais corretas de aluno levam à home do aluno', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'LeaoAzul42', 'girafa-lunar-914');
    expect(await screen.findByRole('heading', { level: 1, name: 'Oi, LeaoAzul42!' })).toBeInTheDocument();
    expect(screen.getByTestId('local')).toHaveTextContent('/aluno');
  });

  it('aceita o apelido sem diferenciar maiúsculas e o e-mail de quem tem e-mail', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, '  ana.professora@example.test ', 'professora-ana-2026');
    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Ana Souza (exemplo)' })).toBeInTheDocument();
    expect(screen.getByText('Escola Escola Municipal Exemplo')).toBeInTheDocument();
  });

  it('senha errada: mensagem genérica no resumo, com foco, e o campo de senha não é limpo à força', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'LeaoAzul42', 'errada-errada');
    const resumo = await screen.findByRole('alert');
    expect(resumo).toHaveTextContent('Usuário ou senha incorretos.');
    expect(resumo).toHaveFocus();
    expect(screen.getByTestId('local')).toHaveTextContent('/entrar');
  });

  it('mostra "Entrando…" e não envia duas vezes com clique duplo', async () => {
    let chamadas = 0;
    servidor.use(
      http.post('*/api/v1/sessoes', async () => {
        chamadas++;
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 });
      }),
    );
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await usuario.type(screen.getByLabelText('Usuário ou e-mail'), 'LeaoAzul42');
    await usuario.type(screen.getByLabelText('Senha'), 'x');
    const botao = screen.getByRole('button', { name: 'Entrar' });
    await usuario.dblClick(botao);
    expect(await screen.findByRole('button', { name: 'Entrando…' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('alert');
    expect(chamadas).toBe(1);
  });

  it('depois de 3 falhas pede o desafio (428) e entra ao reenviar com o token', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    for (let i = 0; i < 3; i++) {
      await usuario.clear(screen.getByLabelText('Senha'));
      await preencher(usuario, i === 0 ? 'LeaoAzul42' : '', 'errada-errada');
    }
    await preencher(usuario, '', ''); // 4ª tentativa: a API responde 428
    expect(await screen.findByText('Confirme que você não é um robô para continuar.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('checkbox', { name: /Não sou um robô/ }));
    await usuario.clear(screen.getByLabelText('Senha'));
    await usuario.type(screen.getByLabelText('Senha'), 'girafa-lunar-914');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Oi, LeaoAzul42!' })).toBeInTheDocument();
  });

  it('429: avisa para esperar e oferece recuperar o acesso', async () => {
    servidor.use(
      http.post('*/api/v1/sessoes', () =>
        HttpResponse.json({ ok: false, error: { code: 'RATE_LIMITED', message: 'x' } }, { status: 429, headers: { 'Retry-After': '60' } }),
      ),
    );
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'LeaoAzul42', 'qualquer');
    const resumo = await screen.findByRole('alert');
    expect(resumo).toHaveTextContent('Muitas tentativas. Espere alguns minutos e tente de novo.');
    expect(resumo).toHaveTextContent('recupere seu acesso');
  });

  it('erro 500 e falta de conexão têm mensagens próprias (500 traz o código para o suporte)', async () => {
    servidor.use(
      http.post('*/api/v1/sessoes', () =>
        HttpResponse.json({ ok: false, error: { code: 'INTERNAL', message: 'x' } }, { status: 500, headers: { 'X-Request-Id': '01JABC' } }),
      ),
    );
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'LeaoAzul42', 'qualquer');
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado. Tente de novo.');
    expect(screen.getByRole('alert')).toHaveTextContent('Código para o suporte: 01JABC');

    servidor.use(http.post('*/api/v1/sessoes', () => HttpResponse.error()));
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão.'));
  });

  it('conta pendente de autorização vai para a tela de espera', async () => {
    const { apelido } = await cadastrarAlunoPelaApi();
    await sairPelaApi();
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, apelido, 'Senha-de-Teste-123');
    expect(await screen.findByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
  });

  it('quem tem dois papéis escolhe um (T15) e cai na home dele', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'duplo.exemplo@example.test', 'duplo-exemplo-2026');
    expect(await screen.findByRole('heading', { name: 'Como você quer entrar?' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /Professor/ }));
    expect(await screen.findByRole('heading', { name: 'Olá, Beto Lima (exemplo)' })).toBeInTheDocument();
  });

  it('gestor vê "Sua área está chegando."', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'gestora.exemplo@example.test', 'gestora-exemplo-2026');
    expect(await screen.findByRole('heading', { name: 'Sua área está chegando.' })).toBeInTheDocument();
  });

  it('conta em exclusão não entra', async () => {
    const { usuario } = renderizarApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await preencher(usuario, 'NuvemCinza88', 'nuvem-cinza-2026');
    expect(await screen.findByRole('heading', { name: 'Esta conta está sendo apagada.' })).toBeInTheDocument();
  });
});
