import type { Papel } from '@aprendemais/shared-types';
import type { MiddlewareHandler } from 'hono';
import { ErroApp } from './lib/http';
import { obterSessao, papeisEfetivos } from './sessao';
import { papelAtivoDe } from './servicos/me';
import type { AppEnv } from './tipos';

export type Acesso = 'publico' | 'token-link' | 'sessao-pendente' | 'sessao-completa';

/**
 * Autorização por rota (RQ-35, nega por padrão). `publico` e `token-link` passam (o token é conferido pelo serviço);
 * as demais exigem sessão válida lida do KV e revalidada no D1.
 * - `sessao-pendente`: qualquer sessão válida (pendente ou completa).
 * - `sessao-completa`: só sessão completa; sessão pendente → 403 (DC-01).
 * `papeis` (opcional) restringe por papel: o usuário precisa ter algum deles e, se escolheu um papel ativo, ele deve estar na lista.
 */
export function exigeAcesso(acesso: Acesso, papeis?: readonly Papel[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (acesso === 'publico' || acesso === 'token-link') return next();
    const sessao = await obterSessao(c);
    if (!sessao) throw new ErroApp('UNAUTHENTICATED');
    if (acesso === 'sessao-completa' && sessao.kv.esc !== 'completa') throw new ErroApp('FORBIDDEN');
    if (papeis?.length) {
      if (sessao.kv.esc !== 'completa' || !sessao.usuario) throw new ErroApp('FORBIDDEN');
      const efetivos = await papeisEfetivos(c.env, sessao.usuario);
      const ativo = papelAtivoDe(sessao.kv.pa, efetivos);
      const permitido = ativo ? papeis.includes(ativo) : efetivos.some(p => papeis.includes(p));
      if (!permitido) throw new ErroApp('FORBIDDEN');
    }
    return next();
  };
}
