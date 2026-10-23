import type { CadastroProfessorRequest, CadastroProfessorResultado, CampoErro, Pendencia, TokenRequest } from '@aprendemais/shared-types';
import { comandoAuditoria } from '../auditoria';
import { AVISOS, LIMITES, REENVIO, VALIDADE } from '../config';
import { comIdempotencia, type Reconstruida, type Resultado } from '../idempotencia';
import { limitarPorIp } from '../limite';
import { sha256Hex } from '../lib/crypto';
import { ErroApp, ok, validacao } from '../lib/http';
import { ulid } from '../lib/ids';
import { mascararEmail } from '../lib/mascara';
import { avaliarSenha, hashSenha } from '../lib/senha';
import { buscarUsuarioSessao, emitirSessao } from '../sessao';
import { emailE3, linkConfirmacao } from '../servicos/email';
import { montarPendencia } from '../servicos/me';
import { iso, novoToken } from '../servicos/tokens';
import type { Ctx } from '../tipos';
import { corpoDe, enviarDepois, violouUnico } from './comum';

interface LinhaConvite {
  id: string; email: string; papel: 'professor' | 'gestor'; expira_em: string; escola_id: string; escola_nome: string;
}

async function conviteValido(c: Ctx, token: string): Promise<LinhaConvite> {
  const agoraIso = iso(c.var.deps.agora().getTime());
  const l = await c.env.DB.prepare(
    `SELECT cv.id, cv.email, cv.papel, cv.expira_em, e.id AS escola_id, e.nome AS escola_nome
     FROM convites cv JOIN escolas e ON e.id = cv.escola_id
     WHERE cv.token_hash = ? AND cv.aceito_em IS NULL AND cv.expira_em > ?`
  ).bind(await sha256Hex(token), agoraIso).first<LinhaConvite>();
  if (!l) throw new ErroApp('TOKEN_INVALIDO');
  return l;
}

export async function consultarConviteProfessor(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const l = await conviteValido(c, token);
  return ok({ email: l.email, escola: { id: l.escola_id, nome: l.escola_nome }, aviso: AVISOS.professor, expiraEm: l.expira_em });
}

export async function cadastrarProfessor(c: Ctx): Promise<Response> {
  const corpo = corpoDe<CadastroProfessorRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  return comIdempotencia(c, 'POST /professores', () => criarProfessor(c, corpo), ref => reconstruir(c, ref));
}

function resultado(usuario: { id: string; nome: string }, pendencia: Pendencia, cookie: string, ref: string): Resultado {
  const data: CadastroProfessorResultado = { usuario, status: 'pendente_email', pendencia };
  return { status: 201, corpo: { ok: true, data }, headers: { 'Set-Cookie': cookie }, ref };
}

async function criarProfessor(c: Ctx, corpo: CadastroProfessorRequest): Promise<Resultado> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const agoraIso = iso(agoraMs);
  const erros: CampoErro[] = [];
  if (corpo.aviso.versao !== AVISOS.professor.versao) erros.push({ path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' });
  const ruim = avaliarSenha(corpo.senha, null);
  if (ruim) erros.push({ path: 'senha', code: ruim });
  if (erros.length) throw validacao(erros);

  const convite = await conviteValido(c, corpo.token);
  // o portador do convite é o dono do e-mail: aqui o conflito pode ser dito (DC-05)
  const emailUsado = await env.DB.prepare('SELECT 1 AS x FROM usuarios WHERE email = ?').bind(convite.email).first();
  if (emailUsado) throw new ErroApp('CONFLICT', 'Já existe uma conta com este e-mail.', [{ path: 'email', code: 'EMAIL_EM_USO' }]);

  const credencial = await hashSenha(corpo.senha, env);
  const db = env.DB;
  const usuarioId = ulid(agoraMs);
  const consentId = ulid(agoraMs);
  const nome = corpo.nome.trim();
  // Resgate do convite + criação da conta numa transação: cada comando só roda se o convite foi resgatado por este pedido
  const g = { sql: 'EXISTS (SELECT 1 FROM convites WHERE id = ? AND aceito_em = ? AND aceito_por IS NULL)', binds: [convite.id, agoraIso] };
  const tk = await novoToken(db, {
    usuarioId, tipo: 'confirmacao_email', agoraMs, validadeSeg: VALIDADE.confirmacaoEmail, condicao: g
  });
  const expiraConsentimento = iso(agoraMs + VALIDADE.consentimento * 1000);
  let r: D1Result[];
  try {
    r = await db.batch([
      db.prepare('UPDATE convites SET aceito_em = ? WHERE id = ? AND aceito_em IS NULL AND expira_em > ?').bind(agoraIso, convite.id, agoraIso),
      db.prepare(
        `INSERT INTO usuarios (id, papel, status, nome, email, credencial_hash, criado_em, atualizado_em)
         SELECT ?, ?, 'pendente_email', ?, ?, ?, ?, ? WHERE ${g.sql}`
      ).bind(usuarioId, convite.papel, nome, convite.email, credencial, agoraIso, agoraIso, ...g.binds),
      db.prepare(`INSERT INTO escola_membros (escola_id, usuario_id, papel, criado_em) SELECT ?, ?, ?, ? WHERE ${g.sql}`)
        .bind(convite.escola_id, usuarioId, convite.papel, agoraIso, ...g.binds),
      db.prepare(
        `INSERT INTO consentimentos (id, usuario_id, vinculo_id, finalidade, concedido_por, versao_texto, status, solicitado_em, expira_em)
         SELECT ?, ?, NULL, 'uso_plataforma', 'titular', ?, 'pendente', ?, ? WHERE ${g.sql}`
      ).bind(consentId, usuarioId, AVISOS.professor.versao, agoraIso, expiraConsentimento, ...g.binds),
      tk.comando,
      comandoAuditoria(db, { atorId: usuarioId, atorPapel: convite.papel, acao: 'convite.aceitar', alvoTipo: 'convite', alvoId: convite.id, requestId: c.var.requestId, criadoEm: agoraIso }, g),
      comandoAuditoria(db, { atorId: usuarioId, atorPapel: convite.papel, acao: 'conta.cadastrar', alvoTipo: 'usuario', alvoId: usuarioId, requestId: c.var.requestId, criadoEm: agoraIso }, g),
      db.prepare('UPDATE convites SET aceito_por = ? WHERE id = ? AND aceito_por IS NULL AND aceito_em = ?').bind(usuarioId, convite.id, agoraIso)
    ]);
  } catch (e) {
    if (violouUnico(e, 'email')) throw new ErroApp('CONFLICT', 'Já existe uma conta com este e-mail.', [{ path: 'email', code: 'EMAIL_EM_USO' }]);
    throw e;
  }
  if (r[0]?.meta.changes !== 1 || r[1]?.meta.changes !== 1) throw new ErroApp('TOKEN_INVALIDO'); // outro pedido resgatou o convite

  enviarDepois(c, emailE3(convite.email, linkConfirmacao(env, tk.token)));
  const { cookie } = await emitirSessao(env, agoraMs, { u: usuarioId, v: 1, esc: 'pendente', pa: null, perfil: 'pendente' });
  const pendencia: Pendencia = {
    tipo: 'email', emailMascarado: mascararEmail(convite.email), expiraEm: tk.expiraEm,
    proximoReenvioEm: iso(agoraMs + REENVIO.intervaloSeg * 1000)
  };
  return resultado({ id: usuarioId, nome }, pendencia, cookie, usuarioId);
}

async function reconstruir(c: Ctx, ref: string): Promise<Reconstruida | null> {
  const agoraMs = c.var.deps.agora().getTime();
  const u = await buscarUsuarioSessao(c.env, ref);
  if (!u || u.status !== 'pendente_email' || !u.nome) return null;
  const pendencia = await montarPendencia(c.env, agoraMs, u);
  if (!pendencia) return null;
  const { cookie } = await emitirSessao(c.env, agoraMs, { u: u.id, v: u.sessaoVersao, esc: 'pendente', pa: null, perfil: 'pendente' });
  const r = resultado({ id: u.id, nome: u.nome }, pendencia, cookie, ref);
  return { status: r.status, corpo: r.corpo, headers: r.headers };
}
