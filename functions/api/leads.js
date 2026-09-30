export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const nome = String(body.nome || '').trim();
    const sobrenome = String(body.sobrenome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const telefone = String(body.telefone || '').trim();
    const perfil = String(body.perfil || '').trim();
    const consentimento = body.consentimento === true ? 1 : 0;

    if (!nome || !sobrenome || !email || !telefone || !perfil || !consentimento) {
      return json({ ok: false, message: 'Preencha todos os campos e aceite o aviso de privacidade.' }, 400);
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return json({ ok: false, message: 'Digite um e-mail válido.' }, 400);
    }

    if (!context.env.DB) {
      return json({ ok: false, message: 'Banco de dados não configurado no Cloudflare.' }, 500);
    }

    const existing = await context.env.DB.prepare(
      'SELECT id FROM leads WHERE lower(email) = ? OR telefone = ? LIMIT 1'
    ).bind(email, telefone).first();

    let leadId;

    if (existing) {
      await context.env.DB.prepare(
        `UPDATE leads
         SET nome = ?, sobrenome = ?, telefone = ?, perfil = ?, consentimento = 1
         WHERE id = ?`
      ).bind(nome, sobrenome, telefone, perfil, existing.id).run();
      leadId = existing.id;
    } else {
      const result = await context.env.DB.prepare(
        `INSERT INTO leads (nome, sobrenome, email, telefone, perfil, consentimento)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).bind(nome, sobrenome, email, telefone, perfil).run();
      leadId = result.meta.last_row_id;
    }

    return json({ ok: true, leadId });
  } catch (error) {
    return json({ ok: false, message: 'Não foi possível salvar o cadastro.', detail: error.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  });
}
