import type { LoginRequest, LoginResultado, Papel, PapelAtivoRequest } from '@aprendemais/shared-types';
import { LIMITES } from '../config';
import { chaveOpaca, consultar, erroLimite, registrar, zerar } from '../limite';
import { ErroApp, ok } from '../lib/http';
import { verificarSenha, verificarSenhaFalsa } from '../lib/senha';
import {
  apagarSessao, cookieExpirado, emitirSessao, lerTokenDoCookie, papeisEfetivos, perfilTtl, type SessaoAtiva, type UsuarioSessao
} from '../sessao';
import { montarMe, papelAtivoDe } from '../servicos/me';
import { iso } from '../servicos/tokens';
import type { Ctx } from '../tipos';
import { corpoDe, exigirTurnstile } from './comum';

interface LinhaLogin {
  id: string; papel: Papel; status: UsuarioSessao['status']; apelido: string | null; nome: string | null; email: string | null;
  credencial_hash: string | null; ano_escolar: UsuarioSessao['anoEscolar']; sessao_versao: number; criado_em: string;
}

async function buscarParaLogin(c: Ctx, identificador: string): Promise<LinhaLogin | null> {
  const porEmail = identificador.includes('@');
  return c.env.DB.prepare(
    `SELECT id, papel, status, apelido, nome, email, credencial_hash, ano_escolar, sessao_versao, criado_em
     FROM usuarios WHERE ${porEmail ? 'email = ?' : 'lower(apelido) = lower(?)'}`
  ).bind(identificador).first<LinhaLogin>();
}

const MSG_LOGIN = 'Usuário ou senha incorretos.';

export async function entrar(c: Ctx): Promise<Response> {
  const corpo = corpoDe<LoginRequest>(c);
  const { env } = c;
  const L = LIMITES.login;
  const agoraMs = c.var.deps.agora().getTime();
  const identificador = corpo.identificador.trim().toLowerCase();
  const chaveConta = await chaveOpaca(env, `login:${identificador}`);

  // limites por conta (inclusive inexistente) e por IP, antes de gastar CPU com o hash (T10)
  const [porIp, porConta] = await Promise.all([
    consultar(env, agoraMs, 'login-ip', c.var.ipHash),
    consultar(env, agoraMs, 'login-conta', chaveConta)
  ]);
  if (porConta.contagem >= L.bloqueioConta) throw erroLimite(porConta.reiniciaEmSeg);
  if (porIp.contagem >= L.bloqueioIp) throw erroLimite(porIp.reiniciaEmSeg);
  if (porConta.contagem >= L.desafioApos || porIp.contagem >= L.desafioApos) await exigirTurnstile(c, corpo.turnstileToken, true);

  const usuario = await buscarParaLogin(c, identificador);
  const senhaOk = usuario?.credencial_hash
    ? await verificarSenha(corpo.senha, usuario.credencial_hash)
    : await verificarSenhaFalsa(corpo.senha, env); // mesmo custo para conta inexistente (SR-08)
  if (!usuario || !senhaOk) {
    await Promise.all([registrar(env, agoraMs, 'login-ip', c.var.ipHash, L.janelaSeg), registrar(env, agoraMs, 'login-conta', chaveConta, L.janelaSeg)]);
    throw new ErroApp('UNAUTHENTICATED', MSG_LOGIN);
  }
  await zerar(env, 'login-conta', chaveConta);

  // nova sessão sempre: a anterior deste navegador (se houver) morre (SR-05)
  const anterior = lerTokenDoCookie(c.req.header('Cookie'));
  if (anterior) await apagarSessao(env, anterior);

  if (usuario.status !== 'ativa' && usuario.status !== 'pendente_responsavel' && usuario.status !== 'pendente_email') {
    const data: LoginResultado = { status: 'suspensa_exclusao', escopoSessao: 'nenhuma', me: null };
    return ok(data, 200, { 'Set-Cookie': cookieExpirado() });
  }

  const u: UsuarioSessao = {
    id: usuario.id, papel: usuario.papel, status: usuario.status, apelido: usuario.apelido, nome: usuario.nome, email: usuario.email,
    anoEscolar: usuario.ano_escolar, sessaoVersao: usuario.sessao_versao, criadoEm: usuario.criado_em
  };
  const ativa = usuario.status === 'ativa';
  const papeis = ativa ? await papeisEfetivos(env, u) : [];
  const { token, cookie, kv } = await emitirSessao(env, agoraMs, {
    u: u.id, v: u.sessaoVersao, esc: ativa ? 'completa' : 'pendente', pa: papelAtivoDe(null, papeis), perfil: ativa ? perfilTtl(papeis) : 'pendente'
  });
  if (ativa) {
    await env.DB.prepare('UPDATE usuarios SET ultimo_acesso_em = ? WHERE id = ?').bind(iso(agoraMs), u.id).run();
  }
  const sessao: SessaoAtiva = { token, kv, usuario: u };
  const data: LoginResultado = {
    status: usuario.status,
    escopoSessao: ativa ? 'completa' : 'pendente',
    me: await montarMe(env, agoraMs, sessao)
  };
  return ok(data, 200, { 'Set-Cookie': cookie });
}

/** Logout idempotente: sem sessão (ou sessão já inválida) também é 200. */
export async function sair(c: Ctx): Promise<Response> {
  const token = lerTokenDoCookie(c.req.header('Cookie'));
  if (token) await apagarSessao(c.env, token);
  return ok({}, 200, { 'Set-Cookie': cookieExpirado() });
}

export async function escolherPapel(c: Ctx): Promise<Response> {
  const { papel } = corpoDe<PapelAtivoRequest>(c);
  const s = c.var.sessao;
  if (!s?.usuario) throw new ErroApp('UNAUTHENTICATED');
  const agoraMs = c.var.deps.agora().getTime();
  const efetivos = await papeisEfetivos(c.env, s.usuario);
  if (!efetivos.includes(papel)) throw new ErroApp('FORBIDDEN');

  // troca de papel emite um novo cookie e invalida o anterior (SR-05); o limite absoluto da sessão não se prolonga
  const { cookie, token, kv } = await emitirSessao(c.env, agoraMs, {
    u: s.usuario.id, v: s.usuario.sessaoVersao, esc: 'completa', pa: papel, perfil: perfilTtl(efetivos), absoluto: s.kv.abs
  });
  await apagarSessao(c.env, s.token);
  return ok(await montarMe(c.env, agoraMs, { token, kv, usuario: s.usuario }), 200, { 'Set-Cookie': cookie });
}

export async function obterMe(c: Ctx): Promise<Response> {
  const s = c.var.sessao;
  if (!s) throw new ErroApp('UNAUTHENTICATED');
  return ok(await montarMe(c.env, c.var.deps.agora().getTime(), s));
}
