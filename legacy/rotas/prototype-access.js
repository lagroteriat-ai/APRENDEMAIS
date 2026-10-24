import { validarAccessToken } from '../lib/seguranca.js';

export async function registrarAcessoPrototipo(request, env) {
  try {
    const body = await request.json();
    const leadId = Number(body.leadId);
    if (!leadId || !env.DB) {
      return json({ ok: false }, 400);
    }

    if (!(await validarAccessToken(leadId, body.accessToken, env.LEAD_SECRET))) {
      return json({ ok: false }, 403);
    }

    await env.DB.prepare(
      `UPDATE leads
       SET acessou_prototipo = 1, data_acesso_prototipo = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(leadId).run();

    return json({ ok: true });
  } catch (error) {
    console.error('prototype-access POST falhou:', error);
    return json({ ok: false }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
