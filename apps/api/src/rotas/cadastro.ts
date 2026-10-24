import type { CadastroAlunoRequest, CadastroAlunoResultado, CampoErro, CorrigirEmailRequest, Pendencia, TokenRequest } from '@aprendemais/shared-types';
import { comandoAuditoria } from '../auditoria';
import { AVISOS, LIMITES, REENVIO, VALIDADE } from '../config';
import { comIdempotencia, type Reconstruida, type Resultado } from '../idempotencia';
import { chaveOpaca, limitarPorIp, registrar } from '../limite';
import { assinarApelido, gerarApelido, lerApelidoAssinado } from '../lib/apelidos';
import { ehMenor, nascimentoPlausivel } from '../lib/idade';
import { ErroApp, ok, validacao } from '../lib/http';
import { ulid } from '../lib/ids';
import { mascararEmail } from '../lib/mascara';
import { avaliarSenha, hashSenha } from '../lib/senha';
import { buscarUsuarioSessao, emitirSessao, regravarSessao } from '../sessao';
import { emailE1, emailE3, emailE6, linkConsentimento, linkConfirmacao } from '../servicos/email';
import { montarPendencia } from '../servicos/me';
import { buscarTokenValido, comandoConsumir, comandoSubstituir, estadoReenvio, guardaToken, iso, novoToken } from '../servicos/tokens';
import type { Ctx } from '../tipos';
import { corpoDe, enviarDepois, exigirTurnstile, segundosAte, turnstileObrigatorio, violouUnico } from './comum';

// ---------- avisos e apelido ----------

export async function obterAvisosVigentes(): Promise<Response> {
  return ok(AVISOS);
}

export async function sortearApelido(c: Ctx): Promise<Response> {
  await limitarPorIp(c, 'apelido', LIMITES.sortearApelido.limite, LIMITES.sortearApelido.janelaSeg);
  const agoraMs = c.var.deps.agora().getTime();
  for (let i = 0; i < 10; i++) {
    const apelido = gerarApelido();
    const usado = await c.env.DB.prepare('SELECT 1 AS x FROM usuarios WHERE lower(apelido) = lower(?)').bind(apelido).first();
    if (usado) continue;
    const { token, expiraEmMs } = await assinarApelido(apelido, c.env.APP_SECRET, agoraMs);
    return ok({ apelido, apelidoToken: token, expiraEm: iso(expiraEmMs) });
  }
  throw new Error('não foi possível sortear um apelido livre');
}

// ---------- cadastro de aluno ----------

export async function cadastrarAluno(c: Ctx): Promise<Response> {
  const corpo = corpoDe<CadastroAlunoRequest>(c);
  await limitarPorIp(c, 'cadastro', LIMITES.cadastro.limite, LIMITES.cadastro.janelaSeg);
  return comIdempotencia(c, 'POST /cadastro/aluno', () => criarAluno(c, corpo), ref => reconstruirCadastro(c, ref));
}

function resultadoCadastro(
  usuario: { id: string; apelido: string }, status: CadastroAlunoResultado['status'], menor: boolean, pendencia: Pendencia,
  cookie: string, ref: string
): Resultado {
  const data: CadastroAlunoResultado = { usuario, status, menor, pendencia };
  return { status: 201, corpo: { ok: true, data }, headers: { 'Set-Cookie': cookie }, ref };
}

async function criarAluno(c: Ctx, corpo: CadastroAlunoRequest): Promise<Resultado> {
  const { env, var: v } = c;
  const agora = v.deps.agora();
  const agoraMs = agora.getTime();
  await exigirTurnstile(c, corpo.turnstileToken, turnstileObrigatorio(env));

  const apelido = await lerApelidoAssinado(corpo.apelidoToken, env.APP_SECRET, agoraMs);
  if (!apelido) throw validacao([{ path: 'apelidoToken', code: 'APELIDO_INVALIDO' }]);
  const erros: CampoErro[] = [];
  if (!nascimentoPlausivel(corpo.nascimento, agora)) erros.push({ path: 'nascimento', code: 'NASCIMENTO_INVALIDO' });
  if (corpo.aviso.versao !== AVISOS.aluno.versao) erros.push({ path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' });
  const senhaRuim = avaliarSenha(corpo.senha, apelido);
  if (senhaRuim) erros.push({ path: 'senha', code: senhaRuim });
  if (erros.length) throw validacao(erros);

  const menor = ehMenor(corpo.nascimento, agora);
  // O hash é sempre calculado (mesmo no caminho "isca") para o tempo de resposta não revelar nada (SR-08, DC-05).
  const credencial = await hashSenha(corpo.senha, env);

  const apelidoUsado = await env.DB.prepare('SELECT 1 AS x FROM usuarios WHERE lower(apelido) = lower(?)').bind(apelido).first();
  if (apelidoUsado) throw new ErroApp('CONFLICT', 'Esse apelido já existe.', [{ path: 'apelidoToken', code: 'APELIDO_EM_USO' }]);

  if (!menor) {
    const emailUsado = await env.DB.prepare('SELECT 1 AS x FROM usuarios WHERE email = ?').bind(corpo.email).first();
    if (emailUsado) return iscaCadastro(c, apelido, corpo);
  }

  const db = env.DB;
  const usuarioId = ulid(agoraMs);
  const consentId = ulid(agoraMs);
  const agoraIso = iso(agoraMs);
  const tk = await novoToken(db, {
    usuarioId, agoraMs,
    tipo: menor ? 'consentimento' : 'confirmacao_email',
    consentimentoId: menor ? consentId : null,
    validadeSeg: menor ? VALIDADE.consentimento : VALIDADE.confirmacaoEmail
  });
  const expiraConsentimento = iso(agoraMs + VALIDADE.consentimento * 1000);
  const comandos: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO usuarios (id, papel, status, apelido, email, credencial_hash, nascimento_ym, ano_escolar, criado_em, atualizado_em)
       VALUES (?, 'aluno', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(usuarioId, menor ? 'pendente_responsavel' : 'pendente_email', apelido, menor ? null : corpo.email, credencial,
      corpo.nascimento, corpo.anoEscolar, agoraIso, agoraIso)
  ];
  if (menor) {
    const vinculoId = ulid(agoraMs);
    comandos.push(
      db.prepare('INSERT INTO responsaveis_vinculos (id, aluno_id, responsavel_email, criado_em) VALUES (?, ?, ?, ?)')
        .bind(vinculoId, usuarioId, corpo.email, agoraIso),
      db.prepare(
        `INSERT INTO consentimentos (id, usuario_id, vinculo_id, finalidade, concedido_por, versao_texto, status, solicitado_em, expira_em)
         VALUES (?, ?, ?, 'uso_plataforma', 'responsavel', ?, 'pendente', ?, ?)`
      ).bind(consentId, usuarioId, vinculoId, AVISOS.responsavel.versao, agoraIso, expiraConsentimento)
    );
  } else {
    comandos.push(
      db.prepare(
        `INSERT INTO consentimentos (id, usuario_id, vinculo_id, finalidade, concedido_por, versao_texto, status, solicitado_em, expira_em)
         VALUES (?, ?, NULL, 'uso_plataforma', 'titular', ?, 'pendente', ?, ?)`
      ).bind(consentId, usuarioId, AVISOS.aluno.versao, agoraIso, expiraConsentimento)
    );
  }
  comandos.push(
    tk.comando,
    comandoAuditoria(db, { atorId: usuarioId, atorPapel: 'aluno', acao: 'conta.cadastrar', alvoTipo: 'usuario', alvoId: usuarioId, requestId: v.requestId, criadoEm: agoraIso })
  );

  try {
    await db.batch(comandos);
  } catch (e) {
    if (violouUnico(e, 'apelido')) throw new ErroApp('CONFLICT', 'Esse apelido já existe.', [{ path: 'apelidoToken', code: 'APELIDO_EM_USO' }]);
    if (violouUnico(e, 'email')) return iscaCadastro(c, apelido, corpo); // corrida entre dois cadastros com o mesmo e-mail
    throw e;
  }

  enviarDepois(c, menor ? emailE1(corpo.email, apelido, linkConsentimento(env, tk.token)) : emailE3(corpo.email, linkConfirmacao(env, tk.token)));
  const { cookie } = await emitirSessao(env, agoraMs, { u: usuarioId, v: 1, esc: 'pendente', pa: null, perfil: 'pendente' });
  const pendencia: Pendencia = {
    tipo: menor ? 'responsavel' : 'email',
    emailMascarado: mascararEmail(corpo.email),
    expiraEm: tk.expiraEm,
    proximoReenvioEm: iso(agoraMs + REENVIO.intervaloSeg * 1000)
  };
  return resultadoCadastro({ id: usuarioId, apelido }, menor ? 'pendente_responsavel' : 'pendente_email', menor, pendencia, cookie, `u:${usuarioId}`);
}

/** DC-05: e-mail de aluno ≥18 já cadastrado. Responde como sucesso, avisa o dono e entrega uma sessão "isca". */
async function iscaCadastro(c: Ctx, apelido: string, corpo: CadastroAlunoRequest): Promise<Resultado> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const pendencia: Pendencia = {
    tipo: 'email',
    emailMascarado: mascararEmail(corpo.email),
    expiraEm: iso(agoraMs + VALIDADE.confirmacaoEmail * 1000),
    proximoReenvioEm: iso(agoraMs + REENVIO.intervaloSeg * 1000)
  };
  const isca = { id: ulid(agoraMs), apelido, anoEscolar: corpo.anoEscolar, pendencia };
  await env.KV.put(`isca:${isca.id}`, JSON.stringify(isca), { expirationTtl: VALIDADE.confirmacaoEmail });
  const { cookie } = await emitirSessao(env, agoraMs, { u: null, v: 0, esc: 'pendente', pa: null, perfil: 'pendente', isca });

  // aviso ao dono do e-mail, no máximo 3 por dia por endereço (não vira canal de spam)
  const envios = await registrar(env, agoraMs, 'aviso-conta-existente', await chaveOpaca(env, corpo.email), 24 * 3600);
  if (envios.contagem <= REENVIO.maxPorDia) enviarDepois(c, emailE6(corpo.email, `${env.APP_BASE_URL.replace(/\/+$/, '')}/recuperar`));

  return resultadoCadastro({ id: isca.id, apelido }, 'pendente_email', false, pendencia, cookie, `i:${isca.id}`);
}

async function reconstruirCadastro(c: Ctx, ref: string): Promise<Reconstruida | null> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  if (ref.startsWith('i:')) {
    const bruto = await env.KV.get(`isca:${ref.slice(2)}`);
    if (!bruto) return null;
    const isca = JSON.parse(bruto) as { id: string; apelido: string; anoEscolar: CadastroAlunoRequest['anoEscolar']; pendencia: Pendencia };
    const { cookie } = await emitirSessao(env, agoraMs, { u: null, v: 0, esc: 'pendente', pa: null, perfil: 'pendente', isca });
    const r = resultadoCadastro({ id: isca.id, apelido: isca.apelido }, 'pendente_email', false, isca.pendencia, cookie, ref);
    return { status: r.status, corpo: r.corpo, headers: r.headers };
  }
  const u = await buscarUsuarioSessao(env, ref.slice(2));
  if (!u || !u.apelido || (u.status !== 'pendente_responsavel' && u.status !== 'pendente_email')) return null;
  const pendencia = await montarPendencia(env, agoraMs, u);
  if (!pendencia) return null;
  const { cookie } = await emitirSessao(env, agoraMs, { u: u.id, v: u.sessaoVersao, esc: 'pendente', pa: null, perfil: 'pendente' });
  const r = resultadoCadastro({ id: u.id, apelido: u.apelido }, u.status as CadastroAlunoResultado['status'], u.status === 'pendente_responsavel', pendencia, cookie, ref);
  return { status: r.status, corpo: r.corpo, headers: r.headers };
}

// ---------- pendência: reenvio e correção de e-mail (sessão pendente) ----------

async function carregarPendente(c: Ctx) {
  const s = c.var.sessao;
  if (!s || s.kv.esc !== 'pendente') throw new ErroApp('FORBIDDEN');
  return s;
}

/** Emite novo link (invalida o anterior) e reenvia. Devolve a pendência atualizada. */
async function reemitirLink(c: Ctx, usuario: NonNullable<Awaited<ReturnType<typeof buscarUsuarioSessao>>>, email: string, aplicarEmail?: D1PreparedStatement): Promise<Pendencia> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const agoraIso = iso(agoraMs);
  const db = env.DB;
  const menor = usuario.status === 'pendente_responsavel';
  const tipo = menor ? 'consentimento' : 'confirmacao_email';
  const consentimento = menor
    ? await db.prepare("SELECT id FROM consentimentos WHERE usuario_id = ? AND finalidade = 'uso_plataforma' AND status = 'pendente'").bind(usuario.id).first<{ id: string }>()
    : null;
  if (menor && !consentimento) throw new ErroApp('FORBIDDEN');
  // o prazo do pré-cadastro (RQ-05) corre desde a criação: reenviar não o estende
  const limiteMs = Date.parse(usuario.criadoEm) + VALIDADE.consentimento * 1000;
  const tk = await novoToken(db, {
    usuarioId: usuario.id, tipo, consentimentoId: consentimento?.id ?? null, agoraMs,
    validadeSeg: menor ? VALIDADE.consentimento : VALIDADE.confirmacaoEmail, limiteMs
  });
  const comandos = [comandoSubstituir(db, usuario.id, tipo, agoraIso), tk.comando];
  if (aplicarEmail) comandos.unshift(aplicarEmail);
  await db.batch(comandos);

  const apelido = usuario.apelido ?? '';
  enviarDepois(c, menor ? emailE1(email, apelido, linkConsentimento(env, tk.token)) : emailE3(email, linkConfirmacao(env, tk.token)));
  const reenvio = await estadoReenvio(env, usuario.id, tipo, agoraMs);
  return { tipo: menor ? 'responsavel' : 'email', emailMascarado: mascararEmail(email), expiraEm: tk.expiraEm, proximoReenvioEm: reenvio.proximoEm };
}

export async function reenviarPendencia(c: Ctx): Promise<Response> {
  const s = await carregarPendente(c);
  if (!s.usuario) return ok(s.kv.isca!.pendencia, 202); // isca: parece sucesso, nada acontece (DC-05)
  const agoraMs = c.var.deps.agora().getTime();
  const tipo = s.usuario.status === 'pendente_responsavel' ? 'consentimento' : 'confirmacao_email';
  const est = await estadoReenvio(c.env, s.usuario.id, tipo, agoraMs);
  if (est.esgotado || (est.enviadosHoje > 0 && Date.parse(est.proximoEm) > agoraMs)) {
    throw new ErroApp('RATE_LIMITED', 'Espere um pouco para pedir de novo.', undefined, { 'Retry-After': String(segundosAte(est.proximoEm, agoraMs)) });
  }
  const email = await emailDaPendencia(c, s.usuario.id, s.usuario.status, s.usuario.email);
  if (!email) throw new ErroApp('FORBIDDEN');
  return ok(await reemitirLink(c, s.usuario, email), 202);
}

async function emailDaPendencia(c: Ctx, usuarioId: string, status: string, emailProprio: string | null): Promise<string | null> {
  if (status === 'pendente_email') return emailProprio;
  const v = await c.env.DB.prepare('SELECT responsavel_email FROM responsaveis_vinculos WHERE aluno_id = ? ORDER BY criado_em DESC LIMIT 1')
    .bind(usuarioId).first<{ responsavel_email: string }>();
  return v?.responsavel_email ?? null;
}

export async function corrigirEmailPendencia(c: Ctx): Promise<Response> {
  const s = await carregarPendente(c);
  const { email } = corpoDe<CorrigirEmailRequest>(c);
  const agoraMs = c.var.deps.agora().getTime();
  if (!s.usuario) {
    // isca: só atualiza o que o /me mostra
    const kv = s.kv;
    kv.isca!.pendencia = { ...kv.isca!.pendencia, emailMascarado: mascararEmail(email) };
    await regravarSessao(c.env, s.token, kv, agoraMs);
    return ok(kv.isca!.pendencia);
  }
  const u = s.usuario;
  const tipo = u.status === 'pendente_responsavel' ? 'consentimento' : 'confirmacao_email';
  const est = await estadoReenvio(c.env, u.id, tipo, agoraMs);
  if (est.esgotado) {
    throw new ErroApp('RATE_LIMITED', 'Espere um pouco para pedir de novo.', undefined, { 'Retry-After': String(segundosAte(est.proximoEm, agoraMs)) });
  }
  const db = c.env.DB;
  const agoraIso = iso(agoraMs);
  if (u.status === 'pendente_responsavel') {
    const aplicar = db.prepare('UPDATE responsaveis_vinculos SET responsavel_email = ? WHERE aluno_id = ?').bind(email, u.id);
    return ok(await reemitirLink(c, u, email, aplicar));
  }
  // aluno ≥18: o e-mail é o login; se já é de outra conta não revelamos (DC-05)
  const outra = await db.prepare('SELECT 1 AS x FROM usuarios WHERE email = ? AND id <> ?').bind(email, u.id).first();
  if (outra) {
    const envios = await registrar(c.env, agoraMs, 'aviso-conta-existente', await chaveOpaca(c.env, email), 24 * 3600);
    if (envios.contagem <= REENVIO.maxPorDia) enviarDepois(c, emailE6(email, `${c.env.APP_BASE_URL.replace(/\/+$/, '')}/recuperar`));
    return ok({ ...(await montarPendencia(c.env, agoraMs, u)), emailMascarado: mascararEmail(email) });
  }
  const aplicar = db.prepare('UPDATE usuarios SET email = ?, atualizado_em = ? WHERE id = ?').bind(email, agoraIso, u.id);
  try {
    return ok(await reemitirLink(c, u, email, aplicar));
  } catch (e) {
    if (violouUnico(e, 'email')) return ok({ ...(await montarPendencia(c.env, agoraMs, u)), emailMascarado: mascararEmail(email) });
    throw e;
  }
}

// ---------- confirmação de e-mail ----------

export async function confirmarEmail(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const agoraMs = c.var.deps.agora().getTime();
  const agoraIso = iso(agoraMs);
  const tk = await buscarTokenValido(c.env, 'confirmacao_email', token, agoraMs);
  if (!tk) throw new ErroApp('TOKEN_INVALIDO');
  const db = c.env.DB;
  const g = guardaToken(tk.id, agoraIso);
  const usuario = await db.prepare('SELECT papel FROM usuarios WHERE id = ?').bind(tk.usuario_id).first<{ papel: 'aluno' | 'professor' | 'gestor' | 'responsavel' | 'admin' }>();
  if (!usuario) throw new ErroApp('TOKEN_INVALIDO');
  const r = await db.batch([
    comandoConsumir(db, tk.id, agoraIso),
    db.prepare(`UPDATE usuarios SET status = 'ativa', atualizado_em = ? WHERE id = ? AND status = 'pendente_email' AND ${g.sql}`)
      .bind(agoraIso, tk.usuario_id, ...g.binds),
    db.prepare(
      `UPDATE consentimentos SET status = 'concedido', decidido_em = ?
       WHERE usuario_id = ? AND finalidade = 'uso_plataforma' AND concedido_por = 'titular' AND status = 'pendente' AND ${g.sql}`
    ).bind(agoraIso, tk.usuario_id, ...g.binds),
    comandoAuditoria(db, {
      atorId: tk.usuario_id, atorPapel: usuario.papel, acao: 'conta.email_confirmar', alvoTipo: 'usuario', alvoId: tk.usuario_id,
      requestId: c.var.requestId, criadoEm: agoraIso
    }, g)
  ]);
  if (r[0]?.meta.changes !== 1 || r[1]?.meta.changes !== 1) throw new ErroApp('TOKEN_INVALIDO');
  return ok({ status: 'ativa' });
}
