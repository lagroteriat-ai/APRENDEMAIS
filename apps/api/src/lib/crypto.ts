const enc = new TextEncoder();

export function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function bytesParaBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlParaBytes(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function sha256Hex(texto: string): Promise<string> {
  return bytesParaHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto))));
}

async function chaveHmac(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacBytes(segredo: string, dados: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await chaveHmac(segredo), enc.encode(dados)));
}

export async function hmacHex(segredo: string, dados: string): Promise<string> {
  return bytesParaHex(await hmacBytes(segredo, dados));
}

/** Token opaco de 256 bits em base64url (43 caracteres). */
export function tokenAleatorio(bytes = 32): string {
  return bytesParaBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Comparação em tempo constante (compara os digests, sem vazar tamanho nem prefixo). */
export async function igualConstante(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b))
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}
