import { VALIDADE } from '../config';
import { base64UrlParaBytes, bytesParaBase64Url, hmacBytes, igualConstante } from './crypto';

// Apelido do aluno = animal + adjetivo + número (ex.: LeaoAzul42). Só palavras simples, sem acento e sem risco de ofensa (RQ-22).
// Combinações: 48 × 48 × 990 ≈ 2,3 milhões.

const ANIMAIS = [
  'Leao', 'Tigre', 'Panda', 'Coala', 'Tucano', 'Arara', 'Onca', 'Lobo', 'Raposa', 'Coelho', 'Gato', 'Pinguim',
  'Golfinho', 'Baleia', 'Tartaruga', 'Sapo', 'Macaco', 'Girafa', 'Zebra', 'Elefante', 'Canguru', 'Esquilo', 'Falcao',
  'Coruja', 'Colibri', 'Peixe', 'Polvo', 'Foca', 'Urso', 'Cervo', 'Pato', 'Cisne', 'Cavalo', 'Pomba', 'Joaninha',
  'Borboleta', 'Abelha', 'Formiga', 'Jacare', 'Capivara', 'Tamandua', 'Preguica', 'Ariranha', 'Lontra', 'Gaivota',
  'Sabia', 'Mico', 'Camelo'
] as const;

const ADJETIVOS = [
  'Azul', 'Verde', 'Amarelo', 'Laranja', 'Rosa', 'Roxo', 'Dourado', 'Prateado', 'Veloz', 'Esperto', 'Bravo', 'Alegre',
  'Feliz', 'Calmo', 'Curioso', 'Gentil', 'Forte', 'Ligeiro', 'Valente', 'Brilhante', 'Sonhador', 'Divertido',
  'Criativo', 'Atento', 'Sereno', 'Simpatico', 'Corajoso', 'Amigavel', 'Radiante', 'Saltitante', 'Travesso',
  'Sorridente', 'Gigante', 'Pequeno', 'Magico', 'Estrelado', 'Lunar', 'Solar', 'Tropical', 'Marinho', 'Celeste',
  'Gelado', 'Quentinho', 'Fofo', 'Ousado', 'Genial', 'Rapido', 'Leal'
] as const;

function sortear<T>(lista: readonly T[]): T {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return lista[(n[0] ?? 0) % lista.length] as T;
}

export function gerarApelido(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  const numero = 10 + ((n[0] ?? 0) % 990);
  return `${sortear(ANIMAIS)}${sortear(ADJETIVOS)}${numero}`;
}

// ---------- apelidoToken: `<apelido>.<exp>` em base64url + `.` + HMAC ----------

export async function assinarApelido(apelido: string, segredo: string, agoraMs: number): Promise<{ token: string; expiraEmMs: number }> {
  const expiraEmMs = agoraMs + VALIDADE.apelidoToken * 1000;
  const corpo = bytesParaBase64Url(new TextEncoder().encode(`${apelido}.${Math.floor(expiraEmMs / 1000)}`));
  const assinatura = bytesParaBase64Url(await hmacBytes(segredo, corpo));
  return { token: `${corpo}.${assinatura}`, expiraEmMs };
}

/** Devolve o apelido se a assinatura é válida e não venceu; senão `null`. */
export async function lerApelidoAssinado(token: string, segredo: string, agoraMs: number): Promise<string | null> {
  const [corpo, assinatura, resto] = token.split('.');
  if (!corpo || !assinatura || resto !== undefined) return null;
  const esperada = bytesParaBase64Url(await hmacBytes(segredo, corpo));
  if (!(await igualConstante(assinatura, esperada))) return null;
  try {
    const texto = new TextDecoder().decode(base64UrlParaBytes(corpo));
    const i = texto.lastIndexOf('.');
    const apelido = texto.slice(0, i);
    const exp = Number(texto.slice(i + 1));
    if (!/^[A-Za-z]+[0-9]{2,3}$/.test(apelido) || !Number.isFinite(exp) || exp * 1000 < agoraMs) return null;
    return apelido;
  } catch {
    return null;
  }
}
