import { STATUS_HTTP_POR_CODIGO, type CampoErro, type CodigoErro } from '@aprendemais/shared-types';

const MENSAGENS: Record<CodigoErro, string> = {
  VALIDATION_ERROR: 'Há campos para corrigir.',
  TOKEN_INVALIDO: 'Este link não funciona. Ele pode ter expirado ou já ter sido usado.',
  UNAUTHENTICATED: 'Sua sessão acabou. Entre de novo.',
  FORBIDDEN: 'Você não tem acesso a esta página.',
  NOT_FOUND: 'Você não tem acesso a esta página.',
  CONFLICT: 'Já existe um registro com estes dados.',
  IDEMPOTENCY_CONFLICT: 'Esta chave já foi usada com outro conteúdo.',
  DESAFIO_REQUERIDO: 'Confirme que você não é um robô para continuar.',
  RATE_LIMITED: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  INTERNAL: 'Algo deu errado. Tente de novo.'
};

/** Erro de negócio com o formato do ADR-001 §3. Nunca carrega detalhe interno (RQ-32). */
export class ErroApp extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly mensagem: string = MENSAGENS[codigo],
    readonly detalhes?: CampoErro[],
    readonly headers: Record<string, string> = {}
  ) {
    super(codigo);
  }

  get status(): number {
    return STATUS_HTTP_POR_CODIGO[this.codigo];
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const h = new Headers({ 'Content-Type': 'application/json; charset=UTF-8', ...headers });
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function ok(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return json({ ok: true, data }, status, headers);
}

export function respostaErro(erro: ErroApp): Response {
  const error: { code: CodigoErro; message: string; details?: CampoErro[] } = { code: erro.codigo, message: erro.mensagem };
  if (erro.detalhes?.length) error.details = erro.detalhes;
  return json({ ok: false, error }, erro.status, erro.headers);
}

export function validacao(detalhes: CampoErro[]): ErroApp {
  return new ErroApp('VALIDATION_ERROR', MENSAGENS.VALIDATION_ERROR, detalhes);
}

/** Log estruturado sem PII (RQ-30): só nome do erro e mensagem curta com e-mails removidos. */
export function registrarErro(evento: string, requestId: string, erro: unknown): void {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  const msg = e.message.replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 160);
  console.error(JSON.stringify({ evento, requestId, erro: e.name, msg }));
}
