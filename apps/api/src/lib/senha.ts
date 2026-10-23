import { argon2id } from '@noble/hashes/argon2.js';
import type { CodigoCampo } from '@aprendemais/shared-types';
import { ARGON2_PADRAO } from '../config';
import type { Env } from '../env';
import { base64UrlParaBytes, bytesParaBase64Url, igualConstante } from './crypto';
import { SENHAS_COMUNS_TEXTO } from './senhas-comuns';

// Hash de senha: Argon2id (OWASP: m=19 MiB, t=2, p=1), implementação JS auditada (@noble/hashes).
// O WebCrypto do workerd só aceita PBKDF2 com até 100 mil iterações (< 600 mil do SR-10) e não oferece Argon2/scrypt,
// por isso o Argon2id roda em JS puro (sem WASM, que o Workers bloqueia). Formato guardado em `usuarios.credencial_hash`:
//   argon2id$v=19$m=<KiB>,t=<iter>,p=<paralelismo>$<salt base64url>$<hash base64url>

const enc = new TextEncoder();
const DK_LEN = 32;

interface Parametros {
  mKiB: number;
  t: number;
  p: number;
}

function parametros(env: Pick<Env, 'ARGON2_M_KIB' | 'ARGON2_T'>): Parametros {
  const m = Number(env.ARGON2_M_KIB);
  const t = Number(env.ARGON2_T);
  return {
    mKiB: Number.isInteger(m) && m >= 8 ? m : ARGON2_PADRAO.mKiB,
    t: Number.isInteger(t) && t >= 1 ? t : ARGON2_PADRAO.t,
    p: ARGON2_PADRAO.p
  };
}

function derivar(senha: string, salt: Uint8Array, prm: Parametros): Uint8Array {
  return argon2id(enc.encode(senha.normalize('NFKC')), salt, { m: prm.mKiB, t: prm.t, p: prm.p, dkLen: DK_LEN });
}

export async function hashSenha(senha: string, env: Pick<Env, 'ARGON2_M_KIB' | 'ARGON2_T'>): Promise<string> {
  const prm = parametros(env);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = derivar(senha, salt, prm);
  return `argon2id$v=19$m=${prm.mKiB},t=${prm.t},p=${prm.p}$${bytesParaBase64Url(salt)}$${bytesParaBase64Url(hash)}`;
}

/** `false` para formato desconhecido ou senha errada. Não lança. */
export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 5 || partes[0] !== 'argon2id' || partes[1] !== 'v=19') return false;
  const m = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(partes[2] ?? '');
  if (!m) return false;
  const prm: Parametros = { mKiB: Number(m[1]), t: Number(m[2]), p: Number(m[3]) };
  if (prm.mKiB > 262144 || prm.t > 10 || prm.p !== 1) return false; // teto: um hash adulterado não vira DoS
  try {
    const salt = base64UrlParaBytes(partes[3] ?? '');
    const esperado = partes[4] ?? '';
    return await igualConstante(bytesParaBase64Url(derivar(senha, salt, prm)), esperado);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/**
 * Gasta o mesmo custo de uma verificação real quando a conta não existe (SR-08: mesmo tempo de resposta).
 * O hash falso é calculado uma vez por isolate, com os mesmos parâmetros do ambiente.
 */
export async function verificarSenhaFalsa(senha: string, env: Pick<Env, 'ARGON2_M_KIB' | 'ARGON2_T'>): Promise<false> {
  dummy ??= hashSenha('senha-falsa-para-igualar-o-tempo', env);
  await verificarSenha(senha, await dummy);
  return false;
}

let comuns: Set<string> | undefined;

function senhasComuns(): Set<string> {
  comuns ??= new Set(SENHAS_COMUNS_TEXTO.split('\n').filter(Boolean));
  return comuns;
}

/**
 * Regras do produto (DU-05): 8–128 caracteres (o Zod já cuida do tamanho), fora da lista de comuns,
 * diferente do apelido. Devolve o código de erro de campo ou `null` se a senha serve.
 */
export function avaliarSenha(senha: string, apelido?: string | null): CodigoCampo | null {
  const baixa = senha.normalize('NFKC').toLowerCase().trim();
  const compacta = baixa.replace(/[\s_-]+/g, '');
  if (apelido && (baixa === apelido.toLowerCase() || compacta === apelido.toLowerCase())) return 'SENHA_IGUAL_APELIDO';
  const lista = senhasComuns();
  if (lista.has(baixa) || lista.has(compacta)) return 'SENHA_COMUM';
  if (/^(.)\1+$/.test(compacta)) return 'SENHA_COMUM'; // aaaaaaaa
  return null;
}
