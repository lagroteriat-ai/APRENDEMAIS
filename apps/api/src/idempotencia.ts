import { VALIDADE } from './config';
import { sha256Hex } from './lib/crypto';
import { ErroApp, json, validacao } from './lib/http';
import type { Ctx } from './tipos';

// `Idempotency-Key` (ADR-001 §3, DC-09). A tabela só guarda IDs (nunca PII): a resposta guardada é uma referência
// (`ref`) com a qual o servidor reconstrói a resposta a partir do banco.

export interface Resultado {
  status: number;
  corpo: unknown;
  headers?: Record<string, string>;
  /** Referência opaca (ID) para reconstruir a resposta numa repetição. */
  ref: string;
}

export interface Reconstruida {
  status: number;
  corpo: unknown;
  headers?: Record<string, string>;
}

const CHAVE_OK = /^[A-Za-z0-9-]{16,64}$/;

export function lerChaveIdempotencia(c: Ctx): string {
  const chave = c.req.header('Idempotency-Key');
  if (!chave) throw validacao([{ path: 'Idempotency-Key', code: 'OBRIGATORIO' }]);
  if (!CHAVE_OK.test(chave)) throw validacao([{ path: 'Idempotency-Key', code: 'FORMATO_INVALIDO' }]);
  return chave;
}

/**
 * Executa `executar` no máximo uma vez por (escopo, chave). Só sucessos (2xx) ficam guardados: erro de validação libera a
 * chave, para o formulário corrigido poder reutilizá-la.
 */
export async function comIdempotencia(
  c: Ctx,
  escopo: string,
  executar: () => Promise<Resultado>,
  reconstruir: (ref: string) => Promise<Reconstruida | null>
): Promise<Response> {
  const chave = lerChaveIdempotencia(c);
  const db = c.env.DB;
  const agora = c.var.deps.agora();
  const agoraIso = agora.toISOString();
  const expiraIso = new Date(agora.getTime() + VALIDADE.idempotencia * 1000).toISOString();
  const corpoHash = await sha256Hex(c.var.corpoBruto);

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    await db.prepare('DELETE FROM idempotency_keys WHERE escopo = ? AND chave = ? AND expira_em < ?').bind(escopo, chave, agoraIso).run();
    const ins = await db
      .prepare('INSERT OR IGNORE INTO idempotency_keys (escopo, chave, corpo_hash, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)')
      .bind(escopo, chave, corpoHash, agoraIso, expiraIso)
      .run();

    if (ins.meta.changes === 1) {
      try {
        const r = await executar();
        await db.prepare('UPDATE idempotency_keys SET status_http = ?, resposta_json = ? WHERE escopo = ? AND chave = ?')
          .bind(r.status, JSON.stringify({ ref: r.ref }), escopo, chave).run();
        return json(r.corpo, r.status, r.headers);
      } catch (e) {
        await db.prepare('DELETE FROM idempotency_keys WHERE escopo = ? AND chave = ?').bind(escopo, chave).run();
        throw e;
      }
    }

    const existente = await db
      .prepare('SELECT corpo_hash, status_http, resposta_json FROM idempotency_keys WHERE escopo = ? AND chave = ?')
      .bind(escopo, chave)
      .first<{ corpo_hash: string; status_http: number | null; resposta_json: string | null }>();
    if (!existente) continue; // foi apagada entre as duas consultas
    if (existente.corpo_hash !== corpoHash) throw new ErroApp('IDEMPOTENCY_CONFLICT');
    if (existente.status_http === null || !existente.resposta_json) {
      throw new ErroApp('CONFLICT', 'Esta solicitação já está em andamento. Aguarde um instante.');
    }
    const { ref } = JSON.parse(existente.resposta_json) as { ref: string };
    const r = await reconstruir(ref);
    if (r) return json(r.corpo, r.status, { ...r.headers, 'Idempotent-Replayed': 'true' });
    // não dá para reconstruir (ex.: conta já apagada): libera a chave e executa de novo
    await db.prepare('DELETE FROM idempotency_keys WHERE escopo = ? AND chave = ?').bind(escopo, chave).run();
  }
  throw new ErroApp('CONFLICT', 'Esta solicitação já está em andamento. Aguarde um instante.');
}
