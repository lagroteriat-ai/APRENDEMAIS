import type { Env } from '../env';
import { ErroApp } from '../lib/http';
import type { Ctx, MensagemEmail } from '../tipos';

/** Corpo já validado pelo schema da operação (ver `app.ts`). */
export function corpoDe<T>(c: Ctx): T {
  return c.var.corpo as T;
}

/** Roda trabalho depois da resposta (e-mail), para o tempo de resposta não depender do envio. */
export function depois(c: Ctx, trabalho: Promise<unknown>): void {
  const seguro = trabalho.catch(() => undefined);
  try {
    c.executionCtx.waitUntil(seguro);
  } catch {
    // sem ExecutionContext (testes unitários): o trabalho segue solto
  }
}

export function enviarDepois(c: Ctx, mensagem: MensagemEmail): void {
  depois(c, c.var.deps.enviarEmail(mensagem));
}

export function turnstileObrigatorio(env: Env): boolean {
  return env.TURNSTILE_OBRIGATORIO === 'true';
}

/**
 * Desafio Turnstile (DC-06). Obrigatório: sem token → 428. Opcional: se vier token, tem que valer.
 * O token é de uso único; por isso rotas idempotentes chamam isto dentro de `executar`, não antes da repetição.
 */
export async function exigirTurnstile(c: Ctx, token: string | undefined, obrigatorio: boolean): Promise<void> {
  if (!token) {
    if (obrigatorio) throw new ErroApp('DESAFIO_REQUERIDO');
    return;
  }
  if (!(await c.var.deps.verificarTurnstile(token, c.var.ip))) throw new ErroApp('DESAFIO_REQUERIDO');
}

export function segundosAte(isoFuturo: string, agoraMs: number): number {
  return Math.max(1, Math.ceil((Date.parse(isoFuturo) - agoraMs) / 1000));
}

/** Erro de unicidade do SQLite/D1 sobre um nome de coluna/índice. */
export function violouUnico(erro: unknown, trecho: string): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return /UNIQUE constraint failed/i.test(msg) && msg.toLowerCase().includes(trecho);
}
