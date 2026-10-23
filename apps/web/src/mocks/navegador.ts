import { setupWorker } from 'msw/browser';
import { ativarPersistencia } from './banco';
import { handlers } from './handlers';

/** Liga a API simulada no navegador (service worker em `public/mockServiceWorker.js`). */
export async function iniciarMock(): Promise<void> {
  ativarPersistencia();
  await setupWorker(...handlers).start({
    onUnhandledFrame: 'bypass', // rotas fora do contrato de auth (ex.: assets do Vite) seguem normalmente
    quiet: false,
  });
  console.info('[mock] API simulada ligada. Defina VITE_API_MOCK=false para usar /api/v1 de verdade.');
}
