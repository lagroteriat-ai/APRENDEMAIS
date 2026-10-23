import type { NovaSenhaRequest, RecuperacaoRequest, TokenRequest } from '@aprendemais/shared-types';
import { comandoAuditoria } from '../auditoria';
import { LIMITES, VALIDADE } from '../config';
import { chaveOpaca, limitarPor, limitarPorIp } from '../limite';
import { ErroApp, ok, validacao } from '../lib/http';
import { avaliarSenha, hashSenha } from '../lib/senha';
import { emailE4, linkRecuperacao } from '../servicos/email';
import { buscarTokenValido, comandoConsumir, comandoSubstituir, estadoReenvio, guardaToken, iso, novoToken } from '../servicos/tokens';
import type { Ctx } from '../tipos';
import { corpoDe, depois, exigirTurnstile, turnstileObrigatorio } from './comum';

interface Conta {
  id: string; papel: string; status: string; apelido: string | null; email: string | null;
}

async function contaPorIdentificador(c: Ctx, identificador: string): Promise<Conta | null> {
  const porEmail = identificador.includes('@');
  return c.env.DB.prepare(
    `SELECT id, papel, status, apelido, email FROM usuarios WHERE ${porEmail ? 'email = ?' : 'lower(apelido) = lower(?)'}`
  ).bind(identificador).first<Conta>();
}

/**
 * Pedido de recuperação (T09): **sempre 202, com a mesma resposta e o mesmo tempo**, exista a conta ou não (SR-08).
 * O limite por conta conta também contas inexistentes. O trabalho de verdade roda depois da resposta.
 */
export async function solicitarRecuperacao(c: Ctx): Promise<Response> {
  const corpo = corpoDe<RecuperacaoRequest>(c);
  const identificador = corpo.identificador.trim().toLowerCase();
  await limitarPorIp(c, 'recuperacao-ip', LIMITES.recuperacaoIp.limite, LIMITES.recuperacaoIp.janelaSeg);
  await limitarPor(c, 'recuperacao-conta', await chaveOpaca(c.env, `recuperacao:${identificador}`), LIMITES.recuperacaoConta.limite, LIMITES.recuperacaoConta.janelaSeg);
  await exigirTurnstile(c, corpo.turnstileToken, turnstileObrigatorio(c.env));
  depois(c, enviarLinkRecuperacao(c, identificador));
  return ok({}, 202);
}

async function enviarLinkRecuperacao(c: Ctx, identificador: string): Promise<void> {
  const { env } = c;
  const agoraMs = c.var.deps.agora().getTime();
  const conta = await contaPorIdentificador(c, identificador);
  if (!conta || conta.status !== 'ativa') return;
  // menor: o link vai ao e-mail do responsável (DU-03), mas só se já foi confirmado
  const destino = conta.email ?? (
    await env.DB.prepare('SELECT responsavel_email FROM responsaveis_vinculos WHERE aluno_id = ? AND confirmado_em IS NOT NULL ORDER BY confirmado_em DESC LIMIT 1')
      .bind(conta.id).first<{ responsavel_email: string }>()
  )?.responsavel_email;
  if (!destino) return;
  if ((await estadoReenvio(env, conta.id, 'recuperacao_senha', agoraMs)).esgotado) return;

  const db = env.DB;
  const tk = await novoToken(db, { usuarioId: conta.id, tipo: 'recuperacao_senha', agoraMs, validadeSeg: VALIDADE.recuperacaoSenha });
  await db.batch([comandoSubstituir(db, conta.id, 'recuperacao_senha', iso(agoraMs)), tk.comando]);
  await c.var.deps.enviarEmail(emailE4(destino, linkRecuperacao(env, tk.token)));
}

async function linkValido(c: Ctx, token: string) {
  const agoraMs = c.var.deps.agora().getTime();
  const tk = await buscarTokenValido(c.env, 'recuperacao_senha', token, agoraMs);
  const conta = tk
    ? await c.env.DB.prepare('SELECT id, papel, status, apelido, email FROM usuarios WHERE id = ?').bind(tk.usuario_id).first<Conta>()
    : null;
  if (!tk || !conta || conta.status !== 'ativa') throw new ErroApp('TOKEN_INVALIDO');
  return { tk, conta };
}

export async function consultarRecuperacao(c: Ctx): Promise<Response> {
  const { token } = corpoDe<TokenRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { tk, conta } = await linkValido(c, token);
  // o apelido só aparece para menor (T10 "Para LeaoAzul42"): quem tem e-mail próprio é maior
  return ok({ apelido: conta.email === null ? conta.apelido : null, expiraEm: tk.expira_em });
}

export async function definirNovaSenha(c: Ctx): Promise<Response> {
  const { token, novaSenha } = corpoDe<NovaSenhaRequest>(c);
  await limitarPorIp(c, 'token', LIMITES.token.limite, LIMITES.token.janelaSeg);
  const { tk, conta } = await linkValido(c, token);
  const ruim = avaliarSenha(novaSenha, conta.apelido);
  if (ruim) throw validacao([{ path: 'novaSenha', code: ruim }]); // não consome o link: dá para tentar outra senha
  const credencial = await hashSenha(novaSenha, c.env);

  const db = c.env.DB;
  const agoraIso = iso(c.var.deps.agora().getTime());
  const g = guardaToken(tk.id, agoraIso);
  const r = await db.batch([
    comandoConsumir(db, tk.id, agoraIso),
    // sessao_versao + 1 encerra todas as sessões do usuário na hora (SR-06)
    db.prepare(
      `UPDATE usuarios SET credencial_hash = ?, sessao_versao = sessao_versao + 1, atualizado_em = ?
       WHERE id = ? AND status = 'ativa' AND ${g.sql}`
    ).bind(credencial, agoraIso, conta.id, ...g.binds),
    db.prepare(
      `UPDATE tokens_acao SET consumido_em = ? WHERE usuario_id = ? AND tipo = 'recuperacao_senha' AND consumido_em IS NULL AND ${g.sql}`
    ).bind(agoraIso, conta.id, ...g.binds),
    comandoAuditoria(db, {
      atorId: conta.id, atorPapel: conta.papel as 'aluno', acao: 'conta.senha_redefinir', alvoTipo: 'usuario', alvoId: conta.id,
      requestId: c.var.requestId, criadoEm: agoraIso
    }, g)
  ]);
  if (r[0]?.meta.changes !== 1 || r[1]?.meta.changes !== 1) throw new ErroApp('TOKEN_INVALIDO');
  return ok({ senhaAlterada: true });
}
