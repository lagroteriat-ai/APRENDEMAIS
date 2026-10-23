import type { Env } from './env';
import { ulid } from './lib/ids';
import type { Deps, MensagemEmail } from './tipos';

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verificarTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET || !token) return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) form.set('remoteip', ip);
    const r = await fetch(TURNSTILE_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    const dados = (await r.json()) as { success?: boolean };
    return dados.success === true;
  } catch {
    return false; // falha fechada: sem confirmação não passa
  }
}

/**
 * Envio de e-mail. Ainda não há provedor contratado (PEN-033): fora de produção grava numa "caixa de saída" no KV
 * (1 h) que o endpoint de desenvolvimento lê; em produção apenas registra o evento, sem destinatário nem link.
 */
async function enviarEmail(env: Env, mensagem: MensagemEmail): Promise<void> {
  if (env.ENVIRONMENT === 'production') {
    console.error(JSON.stringify({ evento: 'email_provedor_nao_configurado', tipo: mensagem.tipo }));
    return;
  }
  await env.KV.put(`outbox:${ulid()}`, JSON.stringify(mensagem), { expirationTtl: 3600 });
}

export function criarDepsPadrao(env: Env): Deps {
  return {
    agora: () => new Date(),
    enviarEmail: m => enviarEmail(env, m),
    verificarTurnstile: (token, ip) => verificarTurnstile(env, token, ip)
  };
}
