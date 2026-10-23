/** Instante congelado usado por todas as fábricas (use com `vi.setSystemTime`). */
export const INSTANTE_FIXO = '2026-10-22T12:00:00.000Z';

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const contadores = new Map<string, number>();

/** Próximo número (1, 2, 3…) de uma sequência nomeada. Zera com `reiniciarFabricas()`. */
export function proximo(nome: string): number {
  const n = (contadores.get(nome) ?? 0) + 1;
  contadores.set(nome, n);
  return n;
}

export function reiniciarFabricas(): void {
  contadores.clear();
}

/** ULID válido e determinístico: o mesmo `n` sempre gera o mesmo ID (nunca colide com ID real). */
export function ulidFixo(n: number): string {
  let resto = n;
  let cauda = '';
  for (let i = 0; i < 16; i++) {
    cauda = ALFABETO.charAt(resto % 32) + cauda;
    resto = Math.floor(resto / 32);
  }
  return `01TESTE000${cauda}`.slice(0, 26);
}

/** PRNG com semente (mulberry32): sequência repetível, para dados "aleatórios" estáveis. */
export function criarAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
