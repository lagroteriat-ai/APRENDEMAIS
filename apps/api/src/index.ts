// Worker da API (Hono, /api/v1). Contrato: apps/api/openapi/auth.yaml. Decisões: DECISOES.md (ADR-001/002).
import { criarApp } from './app';
import type { Env } from './env';
import { executarRetencao } from './retencao';

export { Limitador } from './limitador';

const app = criarApp();

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  // Cron Trigger diário (wrangler.toml [triggers]): retenção e exclusão de dados (RQ-05, RQ-14, RQ-31)
  scheduled: (controller, env, ctx) => {
    ctx.waitUntil(
      executarRetencao(env, new Date(controller.scheduledTime)).then(
        resumo => console.log(JSON.stringify({ evento: 'retencao_concluida', ...resumo })),
        erro => {
          console.error(JSON.stringify({ evento: 'retencao_falhou', erro: erro instanceof Error ? erro.name : 'desconhecido' }));
          throw erro;
        }
      )
    );
  }
} satisfies ExportedHandler<Env>;
