import type { Papel } from '@aprendemais/shared-types';
import { ulid } from './lib/ids';

// Trilha de auditoria (RQ-31) SEM PII: ator e alvo por ID opaco, ação e `requestId`. Nunca nome, e-mail, IP ou corpo.
// Catálogo: docs/dados/dicionario.md (auditoria_acesso.acao). Novos desta tarefa estão marcados com (+).

export type AcaoAuditoria =
  | 'consentimento.conceder'
  | 'consentimento.recusar'
  | 'consentimento.revogar'
  | 'conta.exclusao_solicitar'
  | 'pre_cadastro.apagar'
  | 'conta.cadastrar' // (+)
  | 'conta.email_confirmar' // (+)
  | 'conta.senha_redefinir' // (+)
  | 'convite.aceitar'; // (+)

export interface EventoAuditoria {
  atorId: string | null;
  atorPapel: Papel | 'sistema';
  acao: AcaoAuditoria;
  alvoTipo: 'usuario' | 'consentimento' | 'convite';
  alvoId: string;
  requestId: string;
  criadoEm: string;
}

/**
 * Comando para `DB.batch`. Com `condicao`, só grava se a condição SQL (ex.: um EXISTS sobre o token consumido) for verdadeira.
 */
export function comandoAuditoria(db: D1Database, e: EventoAuditoria, condicao?: { sql: string; binds: unknown[] }): D1PreparedStatement {
  const base = [ulid(Date.parse(e.criadoEm)), e.atorId, e.atorPapel, e.acao, e.alvoTipo, e.alvoId, e.requestId.slice(0, 64), e.criadoEm];
  const colunas = 'id, ator_id, ator_papel, acao, alvo_tipo, alvo_id, request_id, criado_em';
  if (!condicao) {
    return db.prepare(`INSERT INTO auditoria_acesso (${colunas}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(...base);
  }
  return db
    .prepare(`INSERT INTO auditoria_acesso (${colunas}) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${condicao.sql}`)
    .bind(...base, ...condicao.binds);
}
