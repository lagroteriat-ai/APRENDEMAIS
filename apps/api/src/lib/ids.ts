const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID (26 caracteres, Crockford): 48 bits de tempo + 80 bits aleatórios. */
export function ulid(agoraMs: number = Date.now()): string {
  let tempo = '';
  let t = agoraMs;
  for (let i = 0; i < 10; i++) {
    tempo = ALFABETO.charAt(t % 32) + tempo;
    t = Math.floor(t / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  let aleatorio = '';
  for (const b of rand) aleatorio += ALFABETO.charAt(b % 32);
  return tempo + aleatorio;
}
