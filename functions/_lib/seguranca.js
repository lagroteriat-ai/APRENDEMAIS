const encoder = new TextEncoder();

// Compara em tempo constante: compara os digests SHA-256 (tamanho fixo), sem vazar tamanho nem prefixo.
export async function igualConstante(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b)))
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export async function gerarAccessToken(leadId, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(leadId)));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

export async function validarAccessToken(leadId, token, secret) {
  if (!secret || typeof token !== 'string' || !token) return false;
  return igualConstante(token, await gerarAccessToken(leadId, secret));
}

export async function adminAutorizado(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN) return false;
  return igualConstante(token, env.ADMIN_TOKEN);
}
