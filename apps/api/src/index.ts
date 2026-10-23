// Worker da API (Hono, /api/v1). Contrato: apps/api/openapi/auth.yaml. Decisões: DECISOES.md (ADR-001/002).
import { criarApp } from './app';
import type { Env } from './env';

export { Limitador } from './limitador';

const app = criarApp();

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx)
} satisfies ExportedHandler<Env>;
