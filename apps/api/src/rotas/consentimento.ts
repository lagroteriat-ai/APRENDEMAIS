import type {
  CampoErro, ConcessaoRequest, ConsentimentoRegistrado, GestaoConsentimento, PedidoConsentimento, RankingConsentimentoRequest, TokenRequest
} from '@aprendemais/shared-types';
import { comandoAuditoria } from '../auditoria';
import { AVISOS, LIMITES, VALIDADE } from '../config';
import { comIdempotencia, type Reconstruida, type Resultado } from '../idempotencia';
import { limitarPorIp } from '../limite';
import { hmacHex } from '../lib/crypto';
import { ErroApp, ok, validacao } from '../lib/http';
import { obterSessao } from '../sessao';
import { emailE2, linkGerenciar } from '../servicos/email';
import {
  buscarTokenQualquer, buscarTokenValido, comandoConsumir, comandoSubstituir, estadoReenvio, guardaToken, iso, novoToken
} from '../servicos/tokens';
import type { Ctx } from '../tipos';
import { corpoDe, depois, enviarDepois } from './comum';

interface LinhaConsentimento {
  cid: string; cstatus: string; decidido_em: string | null; revogado_em: string | null; expira_em: string | null;
  uid: string; apelido: string | null; ustatus: string; exclusao_solicitada_em: string | null; vinculo_id: string | null;
}

async function carregarConsentimento(c: Ctx, consentimentoId: string): Promise<LinhaConsentimento | null> {
  return c.env.DB.prepare(
    `SELECT c.id AS cid, c.status AS cstatus, c.decidido_em, c.revogado_em, c.expira_em, c.vinculo_id,
            u.id AS uid, u.apelido, u.status AS ustatus, u.exclusao_solicitada_em
     FROM consentimentos c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ?`
  ).bind(consentimentoId).first<LinhaConsentimento>();
}

// ---------- pedido (T06) ----------

async function pedidoValido(c: Ctx, token: string) {
  const agoraMs = c.var.deps.agora().getTime();
  const tk = await buscarTokenValido(c.env, 'consentimento', token, agoraMs);
  const l = tk?.consentimento_id ? await carregarConsentimento(c, tk.consentimento_id) : null;
  if (!tk || !l || l.cstatus !== 'pendente' || l.ustatus !== 'pendente_responsavel' || !l.apelido) throw new ErroApp('TOKEN_INVALIDO');
  return { tk, l: { ...l, apelido: l.apelido } };
}

export async function consultarPedidoConsentimento(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { tk, l } = await pedidoValido(c, token);
  const data: PedidoConsentimento = { apelido: l.apelido, aviso: AVISOS.responsavel, rankingDisponivel: false, expiraEm: tk.expira_em };
  return ok(data);
}

export async function concederConsentimento(c: Ctx): Promise<Response> {
  const corpo = corpoDe<ConcessaoRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  return comIdempotencia(c, 'POST /consentimentos/concessao', () => conceder(c, corpo), ref => reconstruirConcessao(c, ref));
}

async function conceder(c: Ctx, corpo: ConcessaoRequest): Promise<Resultado> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const agoraIso = iso(agoraMs);
  const erros: CampoErro[] = [];
  if (corpo.aviso.versao !== AVISOS.responsavel.versao) erros.push({ path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' });
  if (corpo.rankingAutorizado) erros.push({ path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }); // RQ-21: ranking ainda não existe
  if (erros.length) throw validacao(erros);

  const { tk, l } = await pedidoValido(c, corpo.token);
  // AB3: o próprio aluno (sessão pendente dele) não pode se autorizar pelo link
  const sessao = await obterSessao(c);
  if (sessao?.usuario?.id === l.uid) throw new ErroApp('FORBIDDEN');

  const db = env.DB;
  const vinculo = l.vinculo_id
    ? await db.prepare('SELECT responsavel_email FROM responsaveis_vinculos WHERE id = ?').bind(l.vinculo_id).first<{ responsavel_email: string }>()
    : null;
  if (!l.vinculo_id || !vinculo) throw new ErroApp('TOKEN_INVALIDO');

  const g = guardaToken(tk.id, agoraIso);
  const ipHash = c.var.ip ? await hmacHex(env.IP_HASH_SECRET, c.var.ip) : null;
  const gerenciar = await novoToken(db, {
    usuarioId: l.uid, tipo: 'gerenciar_consentimento', consentimentoId: l.cid, agoraMs, validadeSeg: VALIDADE.gerenciarConsentimento
  });
  const r = await db.batch([
    comandoConsumir(db, tk.id, agoraIso),
    db.prepare(
      `UPDATE consentimentos SET status = 'concedido', versao_texto = ?, decidido_em = ?, ip_hash = ?
       WHERE id = ? AND status = 'pendente' AND ${g.sql}`
    ).bind(corpo.aviso.versao, agoraIso, ipHash, l.cid, ...g.binds),
    db.prepare(`UPDATE responsaveis_vinculos SET responsavel_nome = ?, confirmado_em = ? WHERE id = ? AND ${g.sql}`)
      .bind(corpo.nomeResponsavel.trim(), agoraIso, l.vinculo_id, ...g.binds),
    db.prepare(`UPDATE usuarios SET status = 'ativa', atualizado_em = ? WHERE id = ? AND status = 'pendente_responsavel' AND ${g.sql}`)
      .bind(agoraIso, l.uid, ...g.binds),
    comandoAuditoria(db, {
      atorId: null, atorPapel: 'responsavel', acao: 'consentimento.conceder', alvoTipo: 'consentimento', alvoId: l.cid,
      requestId: c.var.requestId, criadoEm: agoraIso
    }, g),
    gerenciar.comando
  ]);
  if (r[0]?.meta.changes !== 1 || r[1]?.meta.changes !== 1 || r[3]?.meta.changes !== 1) {
    // perdeu a corrida (outro pedido consumiu o link) ou o estado mudou: desfaz o link de gestão criado à toa
    await db.prepare('DELETE FROM tokens_acao WHERE id = ?').bind(gerenciar.id).run();
    throw new ErroApp('TOKEN_INVALIDO');
  }
  enviarDepois(c, emailE2(vinculo.responsavel_email, l.apelido, linkGerenciar(env, gerenciar.token)));
  const data: ConsentimentoRegistrado = { resultado: 'autorizado', protocolo: l.cid, apelido: l.apelido, registradoEm: agoraIso };
  return { status: 200, corpo: { ok: true, data }, ref: l.cid };
}

async function reconstruirConcessao(c: Ctx, ref: string): Promise<Reconstruida | null> {
  const l = await carregarConsentimento(c, ref);
  if (!l?.apelido || !l.decidido_em) return null;
  const data: ConsentimentoRegistrado = { resultado: 'autorizado', protocolo: l.cid, apelido: l.apelido, registradoEm: l.decidido_em };
  return { status: 200, corpo: { ok: true, data } };
}

export async function recusarConsentimento(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { tk, l } = await pedidoValido(c, token);
  const db = c.env.DB;
  const agoraIso = iso(c.var.deps.agora().getTime());
  const g = guardaToken(tk.id, agoraIso);
  const r = await db.batch([
    comandoConsumir(db, tk.id, agoraIso),
    comandoAuditoria(db, {
      atorId: null, atorPapel: 'responsavel', acao: 'consentimento.recusar', alvoTipo: 'usuario', alvoId: l.uid,
      requestId: c.var.requestId, criadoEm: agoraIso
    }, g),
    // apaga o pré-cadastro e, em cascata, o e-mail do responsável, o consentimento e os links (RQ-05)
    db.prepare(`DELETE FROM usuarios WHERE id = ? AND status = 'pendente_responsavel' AND ${g.sql}`).bind(l.uid, ...g.binds)
  ]);
  // o DELETE em cascata pode contar várias linhas em `changes`; basta ter apagado o usuário
  if (r[0]?.meta.changes !== 1 || (r[2]?.meta.changes ?? 0) < 1) throw new ErroApp('TOKEN_INVALIDO');
  return ok({ resultado: 'recusado' });
}

// ---------- gestão (T08) ----------

async function gestaoValida(c: Ctx, token: string) {
  const agoraMs = c.var.deps.agora().getTime();
  const tk = await buscarTokenValido(c.env, 'gerenciar_consentimento', token, agoraMs);
  const l = tk?.consentimento_id ? await carregarConsentimento(c, tk.consentimento_id) : null;
  if (!tk || !l || !l.apelido || !l.decidido_em || (l.cstatus !== 'concedido' && l.cstatus !== 'revogado') || l.ustatus === 'apagada') {
    throw new ErroApp('TOKEN_INVALIDO');
  }
  return { tk, l: { ...l, apelido: l.apelido, decidido_em: l.decidido_em } };
}

function exclusaoPrevista(l: LinhaConsentimento): string | null {
  if (l.ustatus !== 'suspensa_exclusao' || !l.exclusao_solicitada_em) return null;
  return iso(Date.parse(l.exclusao_solicitada_em) + VALIDADE.exclusao * 1000);
}

async function rankingAutorizado(c: Ctx, usuarioId: string): Promise<boolean> {
  const r = await c.env.DB.prepare("SELECT 1 AS x FROM consentimentos WHERE usuario_id = ? AND finalidade = 'ranking' AND status = 'concedido'")
    .bind(usuarioId).first();
  return r !== null;
}

async function montarGestao(c: Ctx, l: LinhaConsentimento & { apelido: string; decidido_em: string }): Promise<GestaoConsentimento> {
  return {
    apelido: l.apelido,
    situacao: l.cstatus === 'concedido' ? 'autorizada' : 'revogada',
    autorizadoEm: l.decidido_em,
    rankingAutorizado: await rankingAutorizado(c, l.uid),
    rankingDisponivel: false,
    exclusaoPrevistaAte: exclusaoPrevista(l)
  };
}

export async function consultarGestaoConsentimento(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { l } = await gestaoValida(c, token);
  return ok(await montarGestao(c, l));
}

export async function definirRankingConsentimento(c: Ctx): Promise<Response> {
  const { token, rankingAutorizado: quer } = corpoDe<RankingConsentimentoRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { l } = await gestaoValida(c, token);
  if (quer) throw validacao([{ path: 'rankingAutorizado', code: 'RANKING_INDISPONIVEL' }]); // ranking ainda não existe
  const agoraIso = iso(c.var.deps.agora().getTime());
  await c.env.DB.prepare(
    "UPDATE consentimentos SET status = 'revogado', revogado_em = ? WHERE usuario_id = ? AND finalidade = 'ranking' AND status = 'concedido'"
  ).bind(agoraIso, l.uid).run();
  return ok(await montarGestao(c, l));
}

export async function revogarConsentimento(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { l } = await gestaoValida(c, token);
  const dados = (l: LinhaConsentimento & { apelido: string }, registradoEm: string): ConsentimentoRegistrado => ({
    resultado: 'revogado', protocolo: l.cid, apelido: l.apelido, registradoEm, exclusaoPrevistaAte: exclusaoPrevista(l) ?? iso(Date.parse(registradoEm) + VALIDADE.exclusao * 1000)
  });
  if (l.cstatus === 'revogado') return ok(dados(l, l.revogado_em ?? l.decidido_em)); // idempotente: mesmo protocolo

  const db = c.env.DB;
  const agoraIso = iso(c.var.deps.agora().getTime());
  const base = { atorId: null, atorPapel: 'responsavel' as const, requestId: c.var.requestId, criadoEm: agoraIso };
  const r = await db.batch([
    db.prepare("UPDATE consentimentos SET status = 'revogado', revogado_em = ? WHERE id = ? AND status = 'concedido'").bind(agoraIso, l.cid),
    db.prepare(
      "UPDATE consentimentos SET status = 'revogado', revogado_em = ? WHERE usuario_id = ? AND finalidade = 'ranking' AND status = 'concedido'"
    ).bind(agoraIso, l.uid),
    // sessao_versao + 1 derruba as sessões do aluno na hora (SR-06); a conta fica bloqueada até o apagamento (≤15 dias, RQ-14)
    db.prepare(
      `UPDATE usuarios SET status = 'suspensa_exclusao', exclusao_solicitada_em = ?, sessao_versao = sessao_versao + 1, atualizado_em = ?
       WHERE id = ? AND status = 'ativa'`
    ).bind(agoraIso, agoraIso, l.uid),
    comandoAuditoria(db, { ...base, acao: 'consentimento.revogar', alvoTipo: 'consentimento', alvoId: l.cid }),
    comandoAuditoria(db, { ...base, acao: 'conta.exclusao_solicitar', alvoTipo: 'usuario', alvoId: l.uid })
  ]);
  if (r[0]?.meta.changes !== 1) {
    // outro pedido revogou primeiro: devolve o estado atual
    const atual = await carregarConsentimento(c, l.cid);
    if (atual?.cstatus === 'revogado' && atual.apelido) return ok(dados({ ...atual, apelido: atual.apelido }, atual.revogado_em ?? agoraIso));
    throw new ErroApp('TOKEN_INVALIDO');
  }
  return ok(dados({ ...l, ustatus: 'suspensa_exclusao', exclusao_solicitada_em: agoraIso }, agoraIso));
}

/** Renovação do link de gestão (expirado). Resposta sempre 202; o trabalho roda depois, sem revelar se o token existe. */
export async function solicitarNovoLinkGestao(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  depois(c, renovarLinkGestao(c, token));
  return ok({}, 202);
}

async function renovarLinkGestao(c: Ctx, token: string): Promise<void> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const tk = await buscarTokenQualquer(env, 'gerenciar_consentimento', token);
  const l = tk?.consentimento_id ? await carregarConsentimento(c, tk.consentimento_id) : null;
  if (!tk || !l || l.cstatus !== 'concedido' || l.ustatus !== 'ativa' || !l.apelido || !l.vinculo_id) return;
  const est = await estadoReenvio(env, l.uid, 'gerenciar_consentimento', agoraMs);
  if (est.esgotado) return;
  const vinculo = await env.DB.prepare('SELECT responsavel_email FROM responsaveis_vinculos WHERE id = ?').bind(l.vinculo_id)
    .first<{ responsavel_email: string }>();
  if (!vinculo) return;
  const db = env.DB;
  const novo = await novoToken(db, {
    usuarioId: l.uid, tipo: 'gerenciar_consentimento', consentimentoId: l.cid, agoraMs, validadeSeg: VALIDADE.gerenciarConsentimento
  });
  await db.batch([comandoSubstituir(db, l.uid, 'gerenciar_consentimento', iso(agoraMs)), novo.comando]);
  await c.var.deps.enviarEmail(emailE2(vinculo.responsavel_email, l.apelido, linkGerenciar(env, novo.token)));
}
