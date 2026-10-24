// Worker da landing legada (ADR-002): substitui as Pages Functions. Congelado até a v1.0.
// Contratos HTTP inalterados: POST /api/leads · POST /api/prototype-access · GET|DELETE /api/admin/leads.
// Os estáticos (dist-legacy/) são servidos pelo próprio Cloudflare: `assets.run_worker_first = ["/api/*"]` no wrangler.toml
// manda só /api/* para cá; qualquer outro caminho que chegue aqui não existe.
import { excluirLead, listarLeads } from './rotas/admin-leads.js';
import { criarLead } from './rotas/leads.js';
import { registrarAcessoPrototipo } from './rotas/prototype-access.js';

const ROTAS = {
  '/api/leads': { POST: criarLead },
  '/api/prototype-access': { POST: registrarAcessoPrototipo },
  '/api/admin/leads': { GET: listarLeads, DELETE: excluirLead }
};

function json(dados, status, headers = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers }
  });
}

export default {
  async fetch(request, env, ctx) {
    const caminho = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const rota = Object.hasOwn(ROTAS, caminho) ? ROTAS[caminho] : undefined;
    if (!rota) return json({ ok: false, message: 'Recurso não encontrado.' }, 404);

    const handler = Object.hasOwn(rota, request.method) ? rota[request.method] : undefined;
    if (!handler) {
      return json({ ok: false, message: 'Método não permitido.' }, 405, { Allow: Object.keys(rota).join(', ') });
    }
    return handler(request, env, ctx);
  }
};
