import { comandoAuditoria, type AcaoAuditoria } from './auditoria';
import type { Env } from './env';

// Rotina de retenção (Cron Trigger diário). Regras: docs/dados/dicionario.md §Retenção e docs/seguranca/lgpd-requisitos.md.
//  - Pré-cadastro sem confirmação em 7 dias → apagado com tudo que depende dele, inclusive o e-mail do responsável (RQ-05).
//  - Conta com revogação/pedido de exclusão (`suspensa_exclusao`) → anonimizada: o `id` fica (pontuações anonimizadas), todo dado pessoal
//    sai, junto com vínculos de responsável, matrículas, links e o `ip_hash` do consentimento (RQ-14, prazo máximo 15 dias).
//  - Links, convites, chaves de idempotência e auditoria vencidos são apagados (RQ-11, RQ-31).
// Fora desta rotina (precisam de e-mail/texto do PED): aviso e anonimização por inatividade de 12 meses (RQ-19).

export const RETENCAO = {
  preCadastroDias: 7,
  tokensDiasAposVencer: 7,
  auditoriaMeses: 24
} as const;

export interface ResumoRetencao {
  preCadastrosApagados: number;
  contasAnonimizadas: number;
  tokensRemovidos: number;
  convitesRemovidos: number;
  chavesIdempotenciaRemovidas: number;
  auditoriasRemovidas: number;
}

const LOTE = 100;
const DIA_MS = 24 * 3600 * 1000;

async function idsDe(db: D1Database, sql: string, ...binds: unknown[]): Promise<string[]> {
  const { results } = await db.prepare(sql).bind(...binds).all<{ id: string }>();
  return results.map(r => r.id);
}

function evento(acao: AcaoAuditoria, id: string, criadoEm: string) {
  return { atorId: null, atorPapel: 'sistema' as const, acao, alvoTipo: 'usuario' as const, alvoId: id, requestId: 'retencao', criadoEm };
}

async function apagarPreCadastros(db: D1Database, agoraIso: string, limiteIso: string): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = await idsDe(
      db,
      "SELECT id FROM usuarios WHERE status IN ('pendente_responsavel', 'pendente_email') AND criado_em <= ? ORDER BY criado_em LIMIT ?",
      limiteIso, LOTE
    );
    if (!ids.length) return total;
    await db.batch(ids.flatMap(id => [
      comandoAuditoria(db, evento('pre_cadastro.apagar', id, agoraIso)),
      // cascata: vínculo e e-mail do responsável, consentimento e links
      db.prepare("DELETE FROM usuarios WHERE id = ? AND status IN ('pendente_responsavel', 'pendente_email')").bind(id)
    ]));
    total += ids.length;
  }
}

async function anonimizarContas(db: D1Database, agoraIso: string): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = await idsDe(db, "SELECT id FROM usuarios WHERE status = 'suspensa_exclusao' ORDER BY exclusao_solicitada_em LIMIT ?", LOTE);
    if (!ids.length) return total;
    await db.batch(ids.flatMap(id => [
      comandoAuditoria(db, evento('conta.anonimizar', id, agoraIso)),
      // o consentimento fica como prova, sem PII: sem IP e (pela cascata SET NULL) sem vínculo com o e-mail do responsável
      db.prepare('UPDATE consentimentos SET ip_hash = NULL WHERE usuario_id = ?').bind(id),
      db.prepare('DELETE FROM responsaveis_vinculos WHERE aluno_id = ?').bind(id),
      db.prepare('DELETE FROM matriculas WHERE aluno_id = ?').bind(id),
      db.prepare('DELETE FROM tokens_acao WHERE usuario_id = ?').bind(id),
      db.prepare('DELETE FROM escola_membros WHERE usuario_id = ?').bind(id),
      db.prepare('DELETE FROM usuario_papeis WHERE usuario_id = ?').bind(id),
      db.prepare(
        `UPDATE usuarios SET status = 'apagada', apelido = NULL, nome = NULL, email = NULL, credencial_hash = NULL,
                nascimento_ym = NULL, ano_escolar = NULL, sessao_versao = sessao_versao + 1, atualizado_em = ?
         WHERE id = ? AND status = 'suspensa_exclusao'`
      ).bind(agoraIso, id)
    ]));
    total += ids.length;
  }
}

async function removidos(db: D1Database, sql: string, ...binds: unknown[]): Promise<number> {
  return (await db.prepare(sql).bind(...binds).run()).meta.changes;
}

export async function executarRetencao(env: Env, agora: Date): Promise<ResumoRetencao> {
  const db = env.DB;
  const agoraIso = agora.toISOString();
  const iso = (ms: number): string => new Date(ms).toISOString();
  const vencidoHa = iso(agora.getTime() - RETENCAO.tokensDiasAposVencer * DIA_MS);
  const auditoriaAte = new Date(agora);
  auditoriaAte.setUTCMonth(auditoriaAte.getUTCMonth() - RETENCAO.auditoriaMeses);

  // 1) dados pessoais primeiro (a ordem importa: tokens do pré-cadastro saem junto com ele)
  const preCadastrosApagados = await apagarPreCadastros(db, agoraIso, iso(agora.getTime() - RETENCAO.preCadastroDias * DIA_MS));
  const contasAnonimizadas = await anonimizarContas(db, agoraIso);
  // 2) o que sobrou de vencido
  return {
    preCadastrosApagados,
    contasAnonimizadas,
    tokensRemovidos: await removidos(db, 'DELETE FROM tokens_acao WHERE expira_em < ? OR consumido_em < ?', vencidoHa, vencidoHa),
    convitesRemovidos: await removidos(db, 'DELETE FROM convites WHERE expira_em < ? OR aceito_em < ?', vencidoHa, vencidoHa),
    chavesIdempotenciaRemovidas: await removidos(db, 'DELETE FROM idempotency_keys WHERE expira_em < ?', agoraIso),
    auditoriasRemovidas: await removidos(db, 'DELETE FROM auditoria_acesso WHERE criado_em < ?', auditoriaAte.toISOString())
  };
}
