import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@aprendemais/ui/styles.css';
import './app.css';
import { App } from './App';
import { ApiProvider } from './estado/api';
import { SessaoProvider } from './estado/sessao';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

// `__API_MOCK__` é resolvido no build: com a API real, o MSW e o painel nem entram no pacote.
const PainelMock = __API_MOCK__ ? lazy(() => import('./mocks/PainelMock')) : null;

async function iniciar() {
  if (__API_MOCK__) {
    const { iniciarMock } = await import('./mocks/navegador');
    await iniciarMock();
  }
  createRoot(raiz!).render(
    <StrictMode>
      <BrowserRouter>
        <ApiProvider>
          <SessaoProvider>
            <App />
          </SessaoProvider>
        </ApiProvider>
      </BrowserRouter>
      {PainelMock && (
        <Suspense fallback={null}>
          <PainelMock />
        </Suspense>
      )}
    </StrictMode>,
  );
}

void iniciar();
