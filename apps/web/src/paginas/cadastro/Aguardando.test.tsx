import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { db } from '../../mocks/banco';
import { servidor } from '../../mocks/servidor';
import { cadastrarAlunoPelaApi, emailFicticio, sairPelaApi, ultimoLink } from '../../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../../testes/renderizar';

describe('T05 · Aguardando autorização / Confirme seu e-mail', () => {
  it('menor: mostra o e-mail mascarado do responsável, o apelido e o prazo (vem de /me, sobrevive ao recarregar)', async () => {
    const { apelido } = await cadastrarAlunoPelaApi({ email: 'maria.exemplo@example.test' });
    const { container } = renderizarApp('/cadastro/aguardando');
    expect(await screen.findByText(/ma\*\*\*@example\.test/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
    expect(screen.getByText(apelido)).toBeInTheDocument();
    expect(screen.getByText(/Quando seu responsável autorizar, você já pode entrar\./)).toBeInTheDocument();
    expect(screen.getByText(/O pedido vale até \d{2}\/\d{2}\/\d{4}\./)).toBeInTheDocument();
    await esperarSemViolacoes(container);
  });

  it('18+: "Confirme seu e-mail" e nada de pedir ao responsável', async () => {
    await cadastrarAlunoPelaApi({ maior: true });
    renderizarApp('/cadastro/aguardando');
    expect(await screen.findByText(/Enviamos um link para confirmar seu e-mail/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
    expect(screen.queryByText(/responsável/)).not.toBeInTheDocument();
  });

  it('sem sessão: "Sua sessão acabou." com botão para entrar', async () => {
    renderizarApp('/cadastro/aguardando');
    expect(await screen.findByRole('heading', { name: 'Sua sessão acabou.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('reenviar: confirma com "Reenviado!" e um novo link invalida o anterior; repetir logo em seguida pede espera', async () => {
    await cadastrarAlunoPelaApi();
    const linkAntigo = ultimoLink('E1');
    db().reenvioAte[db().sessaoUsuarioId!] = 0; // passou o intervalo mínimo
    const { usuario } = renderizarApp('/cadastro/aguardando');
    await usuario.click(await screen.findByRole('button', { name: 'Reenviar e-mail' }));
    expect(await screen.findByText('Reenviado!')).toBeInTheDocument();
    expect(ultimoLink('E1')).not.toBe(linkAntigo);

    await usuario.click(screen.getByRole('button', { name: 'Reenviar e-mail' }));
    expect(await screen.findByText('Espere um pouco para pedir de novo.')).toBeInTheDocument();
  });

  it('corrigir o e-mail: valida, envia e confirma', async () => {
    await cadastrarAlunoPelaApi({ email: 'errado.exemplo@example.test' });
    const { usuario } = renderizarApp('/cadastro/aguardando');
    await usuario.click(await screen.findByRole('button', { name: 'E-mail errado? Corrigir' }));

    await usuario.type(screen.getByLabelText(/E-mail correto do responsável/), 'sem-arroba');
    await usuario.click(screen.getByRole('button', { name: 'Enviar para este e-mail' }));
    expect(screen.getByLabelText(/E-mail correto do responsável/)).toHaveAttribute('aria-invalid', 'true');

    await usuario.clear(screen.getByLabelText(/E-mail correto do responsável/));
    await usuario.type(screen.getByLabelText(/E-mail correto do responsável/), emailFicticio('certo'));
    await usuario.click(screen.getByRole('button', { name: 'Enviar para este e-mail' }));
    expect(await screen.findByText(/E-mail corrigido\./)).toBeInTheDocument();
    expect(db().emails.at(-1)?.para).toMatch(/^certo\d+@example\.test$/);
  });

  it('erro de rede ao reenviar mostra a mensagem e mantém a tela', async () => {
    await cadastrarAlunoPelaApi();
    db().reenvioAte[db().sessaoUsuarioId!] = 0;
    servidor.use(http.post('*/api/v1/cadastro/pendencia/reenvio', () => HttpResponse.error()));
    const { usuario } = renderizarApp('/cadastro/aguardando');
    await usuario.click(await screen.findByRole('button', { name: 'Reenviar e-mail' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
    expect(screen.getByRole('heading', { name: 'Falta pouco!' })).toBeInTheDocument();
  });

  it('"Sair" encerra a sessão e volta ao login', async () => {
    await cadastrarAlunoPelaApi();
    const { usuario } = renderizarApp('/cadastro/aguardando');
    await usuario.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(db().sessaoUsuarioId).toBeNull();
  });

  it('conta que já foi autorizada segue para a home em vez de ficar esperando', async () => {
    await cadastrarAlunoPelaApi();
    const u = db().usuarios.find((x) => x.id === db().sessaoUsuarioId)!;
    u.status = 'ativa';
    u.papeis = ['aluno'];
    renderizarApp('/cadastro/aguardando');
    expect(await screen.findByRole('heading', { name: new RegExp(`Oi, ${u.apelido}!`) })).toBeInTheDocument();
    await sairPelaApi();
  });
});
