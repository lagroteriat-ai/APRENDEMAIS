import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/banco';
import { servidor } from '../../mocks/servidor';
import { cadastrarAlunoPelaApi, entrarPelaApi, sairPelaApi, SENHA_TESTE } from '../../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../../testes/renderizar';

async function abrirPedido() {
  const aluno = await cadastrarAlunoPelaApi();
  await sairPelaApi(); // o responsável abre o link no próprio aparelho, sem a sessão do aluno
  const r = renderizarApp(aluno.link);
  await screen.findByRole('heading', { name: `${aluno.apelido} quer usar o Aprende+` });
  return { ...r, aluno };
}

describe('T06/T07 · Autorização do responsável (por link, sem conta)', () => {
  it('lê o token de ?t=, limpa a URL e mostra o pedido com o que guardamos e o que não fazemos', async () => {
    const { container } = await abrirPedido();
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/responsavel\/autorizar$/); // token saiu da URL (RQ-32)
    expect(screen.getByRole('heading', { name: 'O que guardamos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que NÃO fazemos' })).toBeInTheDocument();
    expect(screen.getByText('pedir CPF, endereço ou foto')).toBeInTheDocument();
    // Sem ranking no Sprint 1: o bloco opcional não aparece.
    expect(screen.queryByText(/ranking/i)).not.toBeInTheDocument();
    await esperarSemViolacoes(container);
  });

  it('Autorizar fica desabilitado, com a razão em texto, até haver nome e a caixa marcada', async () => {
    const { usuario } = await abrirPedido();
    const autorizar = screen.getByRole('button', { name: 'Autorizar' });
    expect(autorizar).toBeDisabled();
    expect(autorizar).toHaveAccessibleDescription('Para autorizar, escreva seu nome e marque a caixa acima.');
    await usuario.type(screen.getByLabelText(/Seu nome/), 'Maria Exemplo');
    expect(autorizar).toBeDisabled();
    await usuario.click(screen.getByRole('checkbox', { name: /Sou responsável por/ }));
    expect(autorizar).toBeEnabled();
  });

  it('"Autorizar" e "Não autorizar" têm o mesmo peso visual (RQ-08)', async () => {
    await abrirPedido();
    const a = screen.getByRole('button', { name: 'Autorizar' });
    const b = screen.getByRole('button', { name: 'Não autorizar' });
    expect(a.className).toBe(b.className);
  });

  it('autoriza: mostra "Tudo certo!" e o aluno passa a conseguir entrar', async () => {
    const { usuario, aluno } = await abrirPedido();
    await usuario.type(screen.getByLabelText(/Seu nome/), 'Maria Exemplo');
    await usuario.click(screen.getByRole('checkbox', { name: /Sou responsável por/ }));
    await usuario.click(screen.getByRole('button', { name: 'Autorizar' }));

    expect(await screen.findByRole('heading', { name: 'Tudo certo!' })).toBeInTheDocument();
    expect(screen.getByText(aluno.apelido)).toBeInTheDocument();
    expect(screen.getByText(/Protocolo: [0-9A-Z]{26}/)).toBeInTheDocument();
    expect(db().usuarios.find((u) => u.apelido === aluno.apelido)?.status).toBe('ativa');
    const entrou = await entrarPelaApi(aluno.apelido, SENHA_TESTE);
    expect(entrou.status).toBe('ativa');
  });

  it('não autoriza: apaga o cadastro e mostra "Tudo bem."', async () => {
    const { usuario, aluno } = await abrirPedido();
    await usuario.click(screen.getByRole('button', { name: 'Não autorizar' }));
    expect(await screen.findByRole('heading', { name: 'Tudo bem.' })).toBeInTheDocument();
    expect(screen.getByText(/Nenhum dado foi guardado/)).toBeInTheDocument();
    expect(db().usuarios.some((u) => u.apelido === aluno.apelido)).toBe(false);
  });

  it('link sem token ou com token que não existe: "Este link não funciona"', async () => {
    renderizarApp('/responsavel/autorizar');
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
    expect(screen.getByText(/O cadastro não autorizado em 7 dias é apagado/)).toBeInTheDocument();
  });

  it('link já usado (uso único) vira "Este link não funciona", sem revelar nada do aluno', async () => {
    const aluno = await cadastrarAlunoPelaApi();
    const primeiro = renderizarApp(aluno.link);
    await screen.findByRole('heading', { name: /quer usar o Aprende\+/ });
    await (await import('@testing-library/user-event')).default.setup().click(screen.getByRole('button', { name: 'Não autorizar' }));
    await screen.findByRole('heading', { name: 'Tudo bem.' });
    primeiro.unmount();

    renderizarApp(aluno.link);
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
    expect(screen.queryByText(aluno.apelido)).not.toBeInTheDocument();
  });

  it('erro de rede ao consultar: "Tentar de novo" recarrega o pedido', async () => {
    const aluno = await cadastrarAlunoPelaApi();
    servidor.use(http.post('*/api/v1/consentimentos/consulta', () => HttpResponse.error(), { once: true }));
    const { usuario } = renderizarApp(aluno.link);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: `${aluno.apelido} quer usar o Aprende+` })).toBeInTheDocument();
  });

  it('erro de campo do servidor aparece ligado ao campo (nome inválido)', async () => {
    servidor.use(
      http.post('*/api/v1/consentimentos/concessao', () =>
        HttpResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: 'x', details: [{ path: 'nomeResponsavel', code: 'NOME_INVALIDO' }] } },
          { status: 400 },
        ),
      ),
    );
    const { usuario } = await abrirPedido();
    await usuario.type(screen.getByLabelText(/Seu nome/), 'Maria Exemplo');
    await usuario.click(screen.getByRole('checkbox', { name: /Sou responsável por/ }));
    await usuario.click(screen.getByRole('button', { name: 'Autorizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escreva seu nome (de 2 a 120 letras).');
    expect(screen.getByLabelText(/Seu nome/)).toHaveAttribute('aria-invalid', 'true');
  });
});
