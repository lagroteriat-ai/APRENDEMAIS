import { REENVIO } from '../config';
import type { Env } from '../env';
import { sha256Hex, tokenAleatorio } from '../lib/crypto';
import { ulid } from '../lib/ids';

// `tokens_acao` (db/migrations/0004): só o hash SHA-256 fica no banco; o token em claro sai apenas no link do e-mail.
// Consumo = `UPDATE ... consumido_em` atômico dentro de um `DB.batch` junto com os efeitos (ver `guardaToken`).

export type TipoToken = 'consentimento' | 'gerenciar_consentimento' | 'recuperacao_senha' | 'confirmacao_email';

export interface TokenAcao {
  id: string;
  usuario_id: string;
  consentimento_id: string | null;
  tipo: TipoToken;
  criado_em: string;
  expira_em: string;
  consumido_em: string | null;
}

export const iso = (ms: number): string => new Date(ms).toISOString();

/** Novo token (em claro) + o comando que grava o hash. Use no mesmo `batch` dos demais efeitos. */
export async function novoToken(
  db: D1Database,
  p: {
    usuarioId: string; tipo: TipoToken; consentimentoId?: string | null; agoraMs: number; validadeSeg: number; limiteMs?: number;
    /** Só grava se a condição SQL for verdadeira (efeito guardado por um consumo/convite). */
    condicao?: { sql: string; binds: unknown[] };
  }
): Promise<{ token: string; id: string; expiraEm: string; comando: D1PreparedStatement }> {
  const token = tokenAleatorio(32);
  const id = ulid(p.agoraMs);
  let expMs = p.agoraMs + p.validadeSeg * 1000;
  if (p.limiteMs !== undefined) expMs = Math.min(expMs, p.limiteMs);
  const expiraEm = iso(expMs);
  const colunas = 'id, usuario_id, consentimento_id, tipo, token_hash, criado_em, expira_em';
  const valores = [id, p.usuarioId, p.consentimentoId ?? null, p.tipo, await sha256Hex(token), iso(p.agoraMs), expiraEm];
  const comando = p.condicao
    ? db.prepare(`INSERT INTO tokens_acao (${colunas}) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${p.condicao.sql}`).bind(...valores, ...p.condicao.binds)
    : db.prepare(`INSERT INTO tokens_acao (${colunas}) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(...valores);
  return { token, id, expiraEm, comando };
}

/** Token ainda utilizável (existe, do tipo certo, não consumido, não vencido). Não consome. */
export async function buscarTokenValido(env: Env, tipo: TipoToken, token: string, agoraMs: number): Promise<TokenAcao | null> {
  return env.DB.prepare(
    `SELECT id, usuario_id, consentimento_id, tipo, criado_em, expira_em, consumido_em FROM tokens_acao
     WHERE token_hash = ? AND tipo = ? AND consumido_em IS NULL AND expira_em > ?`
  ).bind(await sha256Hex(token), tipo, iso(agoraMs)).first<TokenAcao>();
}

/** Procura pelo hash ignorando validade e consumo (renovação de link de gestão). */
export async function buscarTokenQualquer(env: Env, tipo: TipoToken, token: string): Promise<TokenAcao | null> {
  return env.DB.prepare(
    'SELECT id, usuario_id, consentimento_id, tipo, criado_em, expira_em, consumido_em FROM tokens_acao WHERE token_hash = ? AND tipo = ?'
  ).bind(await sha256Hex(token), tipo).first<TokenAcao>();
}

/** Consome o token com um carimbo (o instante da operação). `meta.changes === 1` ⇒ este pedido ganhou. */
export function comandoConsumir(db: D1Database, id: string, agoraIso: string): D1PreparedStatement {
  return db
    .prepare('UPDATE tokens_acao SET consumido_em = ? WHERE id = ? AND consumido_em IS NULL AND expira_em > ?')
    .bind(agoraIso, id, agoraIso);
}

/** Condição SQL "este token foi consumido por esta operação": protege os efeitos que vêm depois do consumo. */
export function guardaToken(id: string, agoraIso: string): { sql: string; binds: unknown[] } {
  return { sql: 'EXISTS (SELECT 1 FROM tokens_acao WHERE id = ? AND consumido_em = ?)', binds: [id, agoraIso] };
}

/** Marca como substituídos os links ainda abertos do mesmo usuário e tipo (antes de emitir um novo). */
export function comandoSubstituir(db: D1Database, usuarioId: string, tipo: TipoToken, agoraIso: string): D1PreparedStatement {
  return db
    .prepare('UPDATE tokens_acao SET consumido_em = ? WHERE usuario_id = ? AND tipo = ? AND consumido_em IS NULL')
    .bind(agoraIso, usuarioId, tipo);
}

export interface EstadoReenvio {
  enviadosHoje: number;
  /** Quando o próximo envio é permitido (pode estar no passado = já liberado). */
  proximoEm: string;
  /** Limite diário atingido. */
  esgotado: boolean;
}

/** Limite de reenvio (≤3 por dia, intervalo mínimo de 5 min), contado em `tokens_acao` como o DAD definiu. */
export async function estadoReenvio(env: Env, usuarioId: string, tipo: TipoToken, agoraMs: number): Promise<EstadoReenvio> {
  const { results } = await env.DB.prepare(
    'SELECT criado_em FROM tokens_acao WHERE usuario_id = ? AND tipo = ? AND criado_em > ? ORDER BY criado_em'
  ).bind(usuarioId, tipo, iso(agoraMs - 24 * 3600 * 1000)).all<{ criado_em: string }>();
  const datas = results.map(r => Date.parse(r.criado_em));
  const esgotado = datas.length >= REENVIO.maxPorDia;
  const ultimo = datas.at(-1);
  const primeiro = datas[0];
  const proximoMs = esgotado && primeiro !== undefined
    ? primeiro + 24 * 3600 * 1000
    : (ultimo ?? agoraMs - REENVIO.intervaloSeg * 1000) + REENVIO.intervaloSeg * 1000;
  return { enviadosHoje: datas.length, proximoEm: iso(proximoMs), esgotado };
}
