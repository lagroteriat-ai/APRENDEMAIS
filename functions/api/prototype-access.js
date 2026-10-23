import { validarAccessToken } from '../_lib/seguranca.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const leadId = Number(body.leadId);
    if (!leadId || !context.env.DB) {
      return json({ ok: false }, 400);
    }

    if (!(await validarAccessToken(leadId, body.accessToken, context.env.LEAD_SECRET))) {
      return json({ ok: false }, 403);
    }

    await context.env.DB.prepare(
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
