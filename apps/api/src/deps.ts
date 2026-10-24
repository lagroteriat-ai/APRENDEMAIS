import { criarProvedorEmail } from './email/provedor';
import type { Env } from './env';
import type { Deps } from './tipos';

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

export function criarDepsPadrao(env: Env): Deps {
  const email = criarProvedorEmail(env);
  return {
    agora: () => new Date(),
    enviarEmail: m => email.enviar(m),
    verificarTurnstile: (token, ip) => verificarTurnstile(env, token, ip)
  };
}
