import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Servidor MSW dos testes (Node). O ciclo de vida fica em `src/testes/preparar.ts`. */
export const servidor = setupServer(...handlers);
