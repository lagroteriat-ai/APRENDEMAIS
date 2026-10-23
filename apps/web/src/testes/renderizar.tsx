import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, useLocation } from 'react-router';
import { expect } from 'vitest';
import { App } from '../App';
import { criarCliente, type Cliente } from '../api/cliente';
import { ApiProvider } from '../estado/api';
import { SessaoProvider } from '../estado/sessao';

function Sonda() {
  const { pathname, search } = useLocation();
  return <output data-testid="local">{pathname + search}</output>;
}

/**
 * Renderiza o app inteiro (rotas + sessão + API simulada) numa rota, em StrictMode como no `vite dev`
 * (pega efeitos que gastam um link de uso único duas vezes). `getByTestId('local')` mostra rota + query.
 */
export function renderizarApp(rota: string, cliente: Cliente = criarCliente()) {
  const usuario = userEvent.setup();
  const tela = render(
    <StrictMode>
      <MemoryRouter initialEntries={[rota]}>
        <ApiProvider cliente={cliente}>
          <SessaoProvider>
            <App />
            <Sonda />
          </SessaoProvider>
        </ApiProvider>
      </MemoryRouter>
    </StrictMode>,
  );
  return { usuario, ...tela };
}

/** Falha se o axe achar violações (contraste fica de fora: jsdom não calcula estilos; ver packages/ui). */
export async function esperarSemViolacoes(container: Element) {
  const r = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
