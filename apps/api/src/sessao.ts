import type { AnoEscolar, Papel, Pendencia, StatusConta } from '@aprendemais/shared-types';
import { COOKIE_SESSAO, SESSAO } from './config';
import type { Env } from './env';
import { sha256Hex, tokenAleatorio } from './lib/crypto';
import type { Ctx } from './tipos';

// Sessão opaca (ADR-001 §4): cookie `__Host-sid` → KV `sess:<sha256(token)>` com a identidade; status, papéis e vínculos
// vêm do D1 a cada requisição. `sessao_versao` do usuário revoga na hora (SR-06), sem esperar a propagação do KV.

export type Escopo = 'completa' | 'pendente';

export interface SessaoKV {
  /** `null` = sessão "isca" (DC-05): não há usuário por trás. */
  u: string | null;
  /** `usuarios.sessao_versao` no momento da emissão. */
  v: number;
  esc: Escopo;
  /** Papel ativo escolhido em T15; revalidado no banco. */
  pa: Papel | null;
  /** Limite absoluto e janela ociosa (epoch ms / ms). */
  abs: number;
  oc: number | null;
  ult: number;
  isca?: { id: string; apelido: string; anoEscolar: AnoEscolar; pendencia: Pendencia };
}

export interface UsuarioSessao {
  id: string;
  papel: Papel;
  status: StatusConta | 'apagada';
  apelido: string | null;
  nome: string | null;
  email: string | null;
  anoEscolar: AnoEscolar | null;
  sessaoVersao: number;
  criadoEm: string;
}

export interface SessaoAtiva {
  token: string;
  kv: SessaoKV;
  /** `null` na sessão isca. */
  usuario: UsuarioSessao | null;
}

const chaveKv = async (token: string): Promise<string> => `sess:${await sha256Hex(token)}`;

export function lerTokenDoCookie(cabecalho: string | null | undefined): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE_SESSAO) return parte.slice(i + 1).trim() || null;
  }
  return null;
}

export function cookieSessao(token: string, maxAgeSeg: number): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(1, Math.floor(maxAgeSeg))}`;
}

export function cookieExpirado(): string {
  return `${COOKIE_SESSAO}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export type PerfilTtl = 'aluno' | 'professor' | 'admin' | 'pendente';

export function perfilTtl(papeis: Papel[]): PerfilTtl {
  if (papeis.includes('admin')) return 'admin';
  if (papeis.includes('gestor') || papeis.includes('professor')) return 'professor';
  return 'aluno';
}

export interface DadosSessao {
  u: string | null;
  v: number;
  esc: Escopo;
  pa: Papel | null;
  perfil: PerfilTtl;
  isca?: SessaoKV['isca'];
  /** Mantém o limite absoluto original (rotação de cookie não prolonga a sessão). */
  absoluto?: number;
}

/** Grava a sessão no KV e devolve o token (só aqui ele existe em claro) e o `Set-Cookie`. */
export async function emitirSessao(env: Env, agoraMs: number, d: DadosSessao): Promise<{ token: string; cookie: string; kv: SessaoKV }> {
  const ttl = SESSAO[d.perfil];
  const abs = d.absoluto ?? agoraMs + ttl.absoluto * 1000;
  const kv: SessaoKV = {
    u: d.u, v: d.v, esc: d.esc, pa: d.pa, abs,
    oc: ttl.ocioso === null ? null : ttl.ocioso * 1000,
    ult: agoraMs,
    ...(d.isca ? { isca: d.isca } : {})
  };
  const token = tokenAleatorio(32);
  const restante = Math.ceil((abs - agoraMs) / 1000);
  await env.KV.put(await chaveKv(token), JSON.stringify(kv), { expirationTtl: Math.max(60, restante) });
  return { token, cookie: cookieSessao(token, restante), kv };
}

/** Regrava o registro da sessão mantendo o prazo absoluto original. */
export async function regravarSessao(env: Env, token: string, kv: SessaoKV, agoraMs: number): Promise<void> {
  await env.KV.put(await chaveKv(token), JSON.stringify(kv), { expirationTtl: Math.max(60, Math.ceil((kv.abs - agoraMs) / 1000)) });
}

export async function apagarSessao(env: Env, token: string): Promise<void> {
  await env.KV.delete(await chaveKv(token));
}

async function lerKv(env: Env, token: string, agoraMs: number): Promise<SessaoKV | null> {
  const bruto = await env.KV.get(await chaveKv(token));
  if (!bruto) return null;
  let kv: SessaoKV;
  try {
    kv = JSON.parse(bruto) as SessaoKV;
  } catch {
    return null;
  }
  const expirou = kv.abs <= agoraMs || (kv.oc !== null && kv.ult + kv.oc <= agoraMs);
  if (expirou) {
    await apagarSessao(env, token);
    return null;
  }
  // "último uso" no KV só de tempos em tempos (KV limita gravações por chave)
  if (kv.oc !== null && agoraMs - kv.ult > SESSAO.atualizarUltimoUsoSeg * 1000) {
    kv.ult = agoraMs;
    await env.KV.put(await chaveKv(token), JSON.stringify(kv), { expirationTtl: Math.max(60, Math.ceil((kv.abs - agoraMs) / 1000)) });
  }
  return kv;
}

interface LinhaUsuario {
  id: string; papel: Papel; status: UsuarioSessao['status']; apelido: string | null; nome: string | null;
  email: string | null; ano_escolar: AnoEscolar | null; sessao_versao: number; criado_em: string;
}

export async function buscarUsuarioSessao(env: Env, id: string): Promise<UsuarioSessao | null> {
  const l = await env.DB.prepare(
    'SELECT id, papel, status, apelido, nome, email, ano_escolar, sessao_versao, criado_em FROM usuarios WHERE id = ?'
  ).bind(id).first<LinhaUsuario>();
  if (!l) return null;
  return {
    id: l.id, papel: l.papel, status: l.status, apelido: l.apelido, nome: l.nome, email: l.email,
    anoEscolar: l.ano_escolar, sessaoVersao: l.sessao_versao, criadoEm: l.criado_em
  };
}

export async function papeisEfetivos(env: Env, usuario: Pick<UsuarioSessao, 'id' | 'papel'>): Promise<Papel[]> {
  const { results } = await env.DB.prepare('SELECT papel FROM usuario_papeis WHERE usuario_id = ?')
    .bind(usuario.id).all<{ papel: Papel }>();
  return [...new Set<Papel>([usuario.papel, ...results.map(r => r.papel)])];
}

/** Carrega e valida a sessão da requisição (uma vez por requisição). Inválida/expirada/revogada → `null`. */
export async function obterSessao(c: Ctx): Promise<SessaoAtiva | null> {
  if (c.var.sessaoCarregada) return c.var.sessao;
  c.set('sessaoCarregada', true);
  const token = lerTokenDoCookie(c.req.header('Cookie'));
  if (!token) return null;
  const agoraMs = c.var.deps.agora().getTime();
  const kv = await lerKv(c.env, token, agoraMs);
  if (!kv) return null;

  let sessao: SessaoAtiva | null;
  if (kv.u === null) {
    sessao = kv.isca ? { token, kv, usuario: null } : null;
  } else {
    const usuario = await buscarUsuarioSessao(c.env, kv.u);
    const statusOk =
      usuario !== null &&
      usuario.sessaoVersao === kv.v &&
      (kv.esc === 'completa' ? usuario.status === 'ativa' : usuario.status === 'pendente_responsavel' || usuario.status === 'pendente_email');
    sessao = statusOk ? { token, kv, usuario } : null;
  }
  if (!sessao) await apagarSessao(c.env, token);
  c.set('sessao', sessao);
  return sessao;
}
