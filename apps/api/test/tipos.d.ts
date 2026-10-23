// Tipos globais dos testes: `env` de `cloudflare:workers` passa a ter os bindings de src/env.ts
// e `exports.default` é o Worker real (test/entrada.ts).
import type { D1Migration } from 'cloudflare:test';
import type { Env as EnvApi } from '../src/env';
import type * as Entrada from './entrada';

declare global {
  namespace Cloudflare {
    interface Env extends EnvApi {
      /** db/migrations lidas pelo vitest.config.ts. */
      TEST_MIGRATIONS: D1Migration[];
    }
    interface GlobalProps {
      mainModule: typeof Entrada;
    }
  }
}
