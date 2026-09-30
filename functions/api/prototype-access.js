export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const leadId = Number(body.leadId);
    if (!leadId || !context.env.DB) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await context.env.DB.prepare(
      `UPDATE leads
       SET acessou_prototipo = 1, data_acesso_prototipo = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(leadId).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
