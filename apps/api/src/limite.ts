import type { EstadoLimite } from './limitador';
import type { Env } from './env';
import { hmacHex } from './lib/crypto';
import { ErroApp } from './lib/http';
import type { Ctx } from './tipos';

// Rate limit sobre o Durable Object `Limitador`. As chaves são sempre HMAC (IP e identificadores nunca ficam em claro).

export async function chaveOpaca(env: Env, valor: string): Promise<string> {
  return (await hmacHex(env.IP_HASH_SECRET, valor)).slice(0, 40);
}

function limitador(env: Env, nome: string, chave: string) {
  return env.LIMITADOR.get(env.LIMITADOR.idFromName(`${nome}:${chave}`));
}

export function registrar(env: Env, agoraMs: number, nome: string, chave: string, janelaSeg: number): Promise<EstadoLimite> {
  return limitador(env, nome, chave).registrar(janelaSeg, agoraMs);
}

export function consultar(env: Env, agoraMs: number, nome: string, chave: string): Promise<EstadoLimite> {
  return limitador(env, nome, chave).consultar(agoraMs);
}

export function zerar(env: Env, nome: string, chave: string): Promise<void> {
  return limitador(env, nome, chave).zerar();
}

export function erroLimite(reiniciaEmSeg: number): ErroApp {
  return new ErroApp('RATE_LIMITED', undefined, undefined, { 'Retry-After': String(Math.max(1, reiniciaEmSeg)) });
}

/** Conta uma tentativa e falha com 429 se passou do limite da janela. `chave` já deve ser opaca. */
export async function limitarPor(c: Ctx, nome: string, chave: string, limite: number, janelaSeg: number): Promise<void> {
  const e = await registrar(c.env, c.var.deps.agora().getTime(), nome, chave, janelaSeg);
  if (e.contagem > limite) throw erroLimite(e.reiniciaEmSeg);
}

export async function limitarPorIp(c: Ctx, nome: string, limite: number, janelaSeg: number): Promise<void> {
  await limitarPor(c, nome, c.var.ipHash, limite, janelaSeg);
}
