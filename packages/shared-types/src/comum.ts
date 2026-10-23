import { z } from 'zod';

// Primitivos e envelope de API (ADR-001 §3). Contrato: apps/api/openapi/auth.yaml.

export const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const dataHoraUtcSchema = z.iso.datetime();
export const tokenSchema = z.string().min(32).max(128);
export const emailMascaradoSchema = z.string();

export type Ulid = z.infer<typeof ulidSchema>;
export type DataHoraUtc = z.infer<typeof dataHoraUtcSchema>;

export const CODIGOS_ERRO = [
  'VALIDATION_ERROR',
  'TOKEN_INVALIDO',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'DESAFIO_REQUERIDO',
  'RATE_LIMITED',
  'INTERNAL'
] as const;
export type CodigoErro = (typeof CODIGOS_ERRO)[number];

export const STATUS_HTTP_POR_CODIGO = {
  VALIDATION_ERROR: 400,
  TOKEN_INVALIDO: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  DESAFIO_REQUERIDO: 428,
  RATE_LIMITED: 429,
  INTERNAL: 500
} as const satisfies Record<CodigoErro, number>;

export const CODIGOS_CAMPO = [
  'OBRIGATORIO',
  'FORMATO_INVALIDO',
  'APELIDO_INVALIDO',
  'APELIDO_EM_USO',
  'EMAIL_INVALIDO',
  'EMAIL_EM_USO',
  'NASCIMENTO_INVALIDO',
  'ANO_ESCOLAR_INVALIDO',
  'SENHA_CURTA',
  'SENHA_LONGA',
  'SENHA_COMUM',
  'SENHA_IGUAL_APELIDO',
  'NOME_INVALIDO',
  'AVISO_DESATUALIZADO',
  'DECLARACAO_OBRIGATORIA',
  'RANKING_INDISPONIVEL',
  'PAPEL_INVALIDO'
] as const;
export type CodigoCampo = (typeof CODIGOS_CAMPO)[number];

export const campoErroSchema = z.object({
  path: z.string(),
  code: z.enum(CODIGOS_CAMPO)
});
export type CampoErro = z.infer<typeof campoErroSchema>;

export const erroRespostaSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(CODIGOS_ERRO),
    message: z.string(),
    details: z.array(campoErroSchema).optional()
  })
});
export type ErroResposta = z.infer<typeof erroRespostaSchema>;

export const okSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    ok: z.literal(true),
    data,
    meta: z.record(z.string(), z.unknown()).optional()
  });

export type RespostaOk<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type Resposta<T> = RespostaOk<T> | ErroResposta;

/** `data` vazio das respostas 202/200 sem conteúdo. */
export const vazioSchema = z.strictObject({});
