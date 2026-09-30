import * as leads from '../functions/api/leads.js';
import * as prototypeAccess from '../functions/api/prototype-access.js';
import * as adminLeads from '../functions/api/admin/leads.js';

const routes = {
  '/api/leads': leads,
  '/api/prototype-access': prototypeAccess,
  '/api/admin/leads': adminLeads
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const module = routes[path];

    if (module) {
      const handler = module[`onRequest${request.method.charAt(0)}${request.method.slice(1).toLowerCase()}`];
      if (!handler) {
        return new Response(JSON.stringify({ ok: false, message: 'Método não permitido.' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      return handler({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  }
};
