// Proteção anti-abuso do cadastro (PEN-004): rate limit por IP + Cloudflare Turnstile.
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TOKEN_MAX = 2048; // limite documentado do Turnstile

export function ipDoCliente(request) {
  return request.headers.get('CF-Connecting-IP') || 'desconhecido';
}

// Binding de Rate Limiting (`env.RATE_LIMITER`, ver wrangler.toml). Retorna true se pode seguir.
// Sem o binding (ex.: `wrangler dev` sem config) não bloqueia, mas avisa no log.
export async function dentroDoLimite(env, ip) {
  if (!env.RATE_LIMITER) {
    console.warn('RATE_LIMITER não configurado: rate limit desativado.');
    return true;
  }
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: `leads:${ip}` });
    return success;
  } catch (error) {
    console.error('rate limit falhou:', error);
    return true; // falha do serviço de limite não derruba o cadastro
  }
}

// Valida o token no servidor. Retorna 'ok' | 'ausente' | 'invalido' | 'indisponivel'.
export async function validarTurnstile(env, token, ip) {
  if (typeof token !== 'string' || !token.trim()) return 'ausente';
  if (token.length > TOKEN_MAX) return 'invalido';

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip && ip !== 'desconhecido') form.append('remoteip', ip);

  try {
    const resposta = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    if (!resposta.ok) throw new Error(`siteverify HTTP ${resposta.status}`);
    const resultado = await resposta.json();
    if (resultado.success === true) return 'ok';
    const codigos = resultado['error-codes'] || [];
    // Erros de configuração (segredo errado) não são culpa do visitante.
    if (codigos.includes('invalid-input-secret') || codigos.includes('missing-input-secret')) {
      console.error('Turnstile: segredo inválido ou ausente.');
      return 'indisponivel';
    }
    return 'invalido';
  } catch (error) {
    console.error('Turnstile siteverify falhou:', error);
    return 'indisponivel';
  }
}
