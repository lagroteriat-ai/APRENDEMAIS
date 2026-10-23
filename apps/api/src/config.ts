// Prazos e limites da API de auth. Fonte: apps/api/openapi/auth.yaml (DC-06, DC-08) e docs/seguranca/threat-model.md (SR-07, SR-09, SR-13).

const MIN = 60;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Validade dos links e tokens, em segundos. */
export const VALIDADE = {
  consentimento: 7 * DIA,
  gerenciarConsentimento: 30 * DIA,
  recuperacaoSenha: 30 * MIN,
  confirmacaoEmail: 7 * DIA,
  apelidoToken: 30 * MIN,
  idempotencia: DIA,
  /** Prazo para apagar a conta depois da revogação (RQ-14). */
  exclusao: 15 * DIA
} as const;

/** Reenvio de link (DU/COMUNICACAO): ≤3 por dia e intervalo mínimo entre envios. */
export const REENVIO = { maxPorDia: 3, intervaloSeg: 5 * MIN } as const;

/** Sessão (ADR-001 §4, SR-07): TTL ocioso e absoluto em segundos; `null` = sem limite ocioso. */
export const SESSAO = {
  aluno: { ocioso: 7 * DIA, absoluto: 30 * DIA },
  professor: { ocioso: 12 * HORA, absoluto: 7 * DIA },
  admin: { ocioso: null, absoluto: 8 * HORA },
  /** Cadastro pendente: dura o prazo do pré-cadastro. */
  pendente: { ocioso: null, absoluto: 7 * DIA },
  /** Intervalo mínimo entre gravações do "último uso" no KV. */
  atualizarUltimoUsoSeg: 5 * MIN
} as const;

export const COOKIE_SESSAO = '__Host-sid';

/** Rate limit (janelas em segundos). */
export const LIMITES = {
  login: { janelaSeg: 15 * MIN, desafioApos: 3, bloqueioConta: 10, bloqueioIp: 100 },
  sortearApelido: { limite: 10, janelaSeg: 10 * MIN },
  cadastro: { limite: 60, janelaSeg: HORA },
  recuperacaoIp: { limite: 20, janelaSeg: HORA },
  recuperacaoConta: { limite: 3, janelaSeg: HORA },
  /** Rotas públicas que recebem token de link (consulta, confirmação, recusa...). */
  token: { limite: 60, janelaSeg: 10 * MIN }
} as const;

/** Avisos de privacidade vigentes (conteúdo: PED-02). A versão é o que se grava em `consentimentos.versao_texto` (≤40). */
export const AVISOS = {
  aluno: { versao: 'aluno-2026-10-v1', publicadoEm: '2026-10-22T00:00:00.000Z' },
  responsavel: { versao: 'responsavel-2026-10-v1', publicadoEm: '2026-10-22T00:00:00.000Z' },
  professor: { versao: 'professor-2026-10-v1', publicadoEm: '2026-10-22T00:00:00.000Z' }
} as const;

/** Custo do Argon2id (OWASP: m=19 MiB, t=2, p=1). */
export const ARGON2_PADRAO = { mKiB: 19456, t: 2, p: 1 } as const;

export const IDADE_MAIORIDADE = 18;
