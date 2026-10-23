import type { Me, Papel, Pendencia } from '@aprendemais/shared-types';
import type { Env } from '../env';
import { mascararEmail } from '../lib/mascara';
import { papeisEfetivos, type SessaoAtiva, type UsuarioSessao } from '../sessao';
import { estadoReenvio } from './tokens';

/** Pendência (T05) de uma conta `pendente_*`: e-mail mascarado, prazo do link e quando dá para reenviar. */
export async function montarPendencia(env: Env, agoraMs: number, u: UsuarioSessao): Promise<Pendencia | null> {
  let tipoToken: 'consentimento' | 'confirmacao_email';
  let email: string | null;
  let tipo: Pendencia['tipo'];
  if (u.status === 'pendente_responsavel') {
    tipoToken = 'consentimento';
    tipo = 'responsavel';
    email = (
      await env.DB.prepare('SELECT responsavel_email FROM responsaveis_vinculos WHERE aluno_id = ? ORDER BY criado_em DESC LIMIT 1')
        .bind(u.id).first<{ responsavel_email: string }>()
    )?.responsavel_email ?? null;
  } else if (u.status === 'pendente_email') {
    tipoToken = 'confirmacao_email';
    tipo = 'email';
    email = u.email;
  } else {
    return null;
  }
  const ativo = await env.DB.prepare(
    'SELECT expira_em FROM tokens_acao WHERE usuario_id = ? AND tipo = ? AND consumido_em IS NULL ORDER BY criado_em DESC LIMIT 1'
  ).bind(u.id, tipoToken).first<{ expira_em: string }>();
  const reenvio = await estadoReenvio(env, u.id, tipoToken, agoraMs);
  return {
    tipo,
    emailMascarado: mascararEmail(email ?? ''),
    expiraEm: ativo?.expira_em ?? new Date(agoraMs).toISOString(),
    proximoReenvioEm: reenvio.proximoEm
  };
}

async function escolaDe(env: Env, usuarioId: string): Promise<{ id: string; nome: string } | null> {
  return env.DB.prepare(
    `SELECT e.id AS id, e.nome AS nome FROM escola_membros m JOIN escolas e ON e.id = m.escola_id
     WHERE m.usuario_id = ? ORDER BY m.criado_em LIMIT 1`
  ).bind(usuarioId).first<{ id: string; nome: string }>();
}

/** Papel ativo: o escolhido (se o usuário ainda o possui) ou o único papel; senão `null` (a SPA mostra T15). */
export function papelAtivoDe(escolhido: Papel | null, papeis: Papel[]): Papel | null {
  if (escolhido && papeis.includes(escolhido)) return escolhido;
  return papeis.length === 1 ? (papeis[0] ?? null) : null;
}

export async function montarMe(env: Env, agoraMs: number, s: SessaoAtiva): Promise<Me> {
  if (!s.usuario) {
    // sessão isca (DC-05): devolve o que o cadastro prometeu, sem usuário real
    const i = s.kv.isca!;
    return {
      id: i.id, status: 'pendente_email', escopoSessao: 'pendente', apelido: i.apelido, nome: null, email: null,
      papeis: [], papelAtivo: null, anoEscolar: i.anoEscolar, escola: null, pendencia: i.pendencia
    };
  }
  const u = s.usuario;
  if (s.kv.esc === 'pendente') {
    return {
      id: u.id, status: u.status as Me['status'], escopoSessao: 'pendente', apelido: u.apelido, nome: null, email: null,
      papeis: [], papelAtivo: null, anoEscolar: u.anoEscolar, escola: null, pendencia: await montarPendencia(env, agoraMs, u)
    };
  }
  const papeis = await papeisEfetivos(env, u);
  const escola = papeis.includes('professor') || papeis.includes('gestor') ? await escolaDe(env, u.id) : null;
  return {
    id: u.id, status: 'ativa', escopoSessao: 'completa', apelido: u.apelido, nome: u.nome, email: u.email,
    papeis, papelAtivo: papelAtivoDe(s.kv.pa, papeis), anoEscolar: u.anoEscolar, escola, pendencia: null
  };
}
