import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { db } from '../mocks/banco';
import { servidor } from '../mocks/servidor';
import { cadastrarAlunoPelaApi } from '../testes/apoio';
import { esperarSemViolacoes, renderizarApp } from '../testes/renderizar';

describe('T12 · Confirmação de e-mail', () => {
  it('confirma o e-mail do aluno 18+ UMA vez (mesmo com StrictMode) e ativa a conta', async () => {
    const aluno = await cadastrarAlunoPelaApi({ maior: true });
    let chamadas = 0;
    servidor.use(
      http.post('*/api/v1/email/confirmacao', async ({ request }) => {
        chamadas++;
        const corpo = await request.clone().json();
        return corpo ? undefined : HttpResponse.json({}, { status: 500 }); // segue para o handler real
      }),
    );
    const { container } = renderizarApp(aluno.link);
    expect(await screen.findByRole('heading', { name: 'E-mail confirmado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(chamadas).toBe(1);
    expect(db().usuarios.find((u) => u.apelido === aluno.apelido)?.status).toBe('ativa');
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/confirmar-email$/);
    await esperarSemViolacoes(container);
  });

  it('link inválido ou já usado: "Este link não funciona" com opção de reenviar', async () => {
    const aluno = await cadastrarAlunoPelaApi({ maior: true });
    const primeiro = renderizarApp(aluno.link);
    await screen.findByRole('heading', { name: 'E-mail confirmado' });
    primeiro.unmount();

    renderizarApp(aluno.link);
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reenviar link' })).toBeInTheDocument();
  });

  it('sem token: link inválido, sem chamar a API', async () => {
    let chamadas = 0;
    servidor.use(http.post('*/api/v1/email/confirmacao', () => (chamadas++, HttpResponse.json({}, { status: 500 }))));
    renderizarApp('/confirmar-email');
    expect(await screen.findByRole('heading', { name: 'Este link não funciona' })).toBeInTheDocument();
    expect(chamadas).toBe(0);
  });
});
