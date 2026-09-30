export async function onRequestGet(context) {
  const auth = context.request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!context.env.ADMIN_TOKEN || token !== context.env.ADMIN_TOKEN) {
    return json({ ok: false, message: 'Não autorizado.' }, 401);
  }

  try {
    const url = new URL(context.request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 500), 1), 1000);

    let result;
    if (q) {
      const like = `%${q}%`;
      result = await context.env.DB.prepare(
        `SELECT id, nome, sobrenome, email, telefone, perfil,
                data_cadastro, acessou_prototipo, data_acesso_prototipo
         FROM leads
         WHERE nome LIKE ? OR sobrenome LIKE ? OR email LIKE ? OR telefone LIKE ?
         ORDER BY datetime(data_cadastro) DESC
         LIMIT ?`
      ).bind(like, like, like, like, limit).all();
    } else {
      result = await context.env.DB.prepare(
        `SELECT id, nome, sobrenome, email, telefone, perfil,
                data_cadastro, acessou_prototipo, data_acesso_prototipo
         FROM leads
         ORDER BY datetime(data_cadastro) DESC
         LIMIT ?`
      ).bind(limit).all();
    }

    const stats = await context.env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN date(data_cadastro) = date('now') THEN 1 ELSE 0 END) AS hoje,
         SUM(CASE WHEN acessou_prototipo = 1 THEN 1 ELSE 0 END) AS acessaram
       FROM leads`
    ).first();

    return json({ ok: true, leads: result.results || [], stats: stats || {} });
  } catch (error) {
    return json({ ok: false, message: 'Erro ao consultar leads.', detail: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const auth = context.request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!context.env.ADMIN_TOKEN || token !== context.env.ADMIN_TOKEN) {
    return json({ ok: false, message: 'Não autorizado.' }, 401);
  }

  try {
    const body = await context.request.json();
    const id = Number(body.id);
    if (!id) return json({ ok: false, message: 'ID inválido.' }, 400);

    await context.env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: 'Não foi possível excluir o lead.', detail: error.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  });
}
