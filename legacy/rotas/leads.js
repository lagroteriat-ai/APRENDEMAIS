import { gerarAccessToken } from '../lib/seguranca.js';
import { dentroDoLimite, ipDoCliente, validarTurnstile } from '../lib/protecao.js';

export async function criarLead(request, env) {
  try {
    const ip = ipDoCliente(request);
    if (!(await dentroDoLimite(env, ip))) {
      return json(
        { ok: false, message: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.' },
        429,
        { 'Retry-After': '60' }
      );
    }

    const body = await request.json();
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

    if (!env.DB) {
      return json({ ok: false, message: 'Banco de dados não configurado no Cloudflare.' }, 500);
    }

    if (!env.LEAD_SECRET) {
      console.error('LEAD_SECRET não configurado.');
      return json({ ok: false, message: 'Serviço indisponível no momento.' }, 500);
    }

    if (!env.TURNSTILE_SECRET) {
      console.error('TURNSTILE_SECRET não configurado.');
      return json({ ok: false, message: 'Serviço indisponível no momento.' }, 500);
    }

    const verificacao = await validarTurnstile(env, body.turnstileToken, ip);
    if (verificacao === 'ausente') {
      return json({ ok: false, message: 'Confirme que você não é um robô para continuar.' }, 400);
    }
    if (verificacao === 'invalido') {
      return json({ ok: false, message: 'Não foi possível confirmar a verificação de segurança. Atualize-a e tente de novo.' }, 400);
    }
    if (verificacao !== 'ok') {
      return json({ ok: false, message: 'Não foi possível validar a verificação de segurança agora. Tente novamente em instantes.' }, 503);
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM leads WHERE lower(email) = ? OR telefone = ? LIMIT 1'
    ).bind(email, telefone).first();

    let leadId;

    if (existing) {
      await env.DB.prepare(
        `UPDATE leads
         SET nome = ?, sobrenome = ?, telefone = ?, perfil = ?, consentimento = 1
         WHERE id = ?`
      ).bind(nome, sobrenome, telefone, perfil, existing.id).run();
      leadId = existing.id;
    } else {
      const result = await env.DB.prepare(
        `INSERT INTO leads (nome, sobrenome, email, telefone, perfil, consentimento)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).bind(nome, sobrenome, email, telefone, perfil).run();
      leadId = result.meta.last_row_id;
    }

    const accessToken = await gerarAccessToken(leadId, env.LEAD_SECRET);
    return json({ ok: true, leadId, accessToken });
  } catch (error) {
    console.error('leads POST falhou:', error);
    return json({ ok: false, message: 'Não foi possível salvar o cadastro.' }, 500);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers }
  });
}
