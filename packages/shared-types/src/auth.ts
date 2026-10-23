import { z } from 'zod';
import {
  dataHoraUtcSchema,
  emailMascaradoSchema,
  okSchema,
  tokenSchema,
  ulidSchema,
  vazioSchema
} from './comum.js';

// Contrato: apps/api/openapi/auth.yaml (v1.0). Qualquer mudança aqui exige mudar o YAML e avisar FE/QA.

// ---------- Primitivos ----------
export const PAPEIS = ['aluno', 'responsavel', 'professor', 'gestor', 'admin'] as const;
export const papelSchema = z.enum(PAPEIS);
export type Papel = z.infer<typeof papelSchema>;

export const STATUS_CONTA = ['pendente_responsavel', 'pendente_email', 'ativa', 'suspensa_exclusao'] as const;
export const statusContaSchema = z.enum(STATUS_CONTA);
export type StatusConta = z.infer<typeof statusContaSchema>;

export const ANOS_ESCOLARES = [
  'EF1', 'EF2', 'EF3', 'EF4', 'EF5', 'EF6', 'EF7', 'EF8', 'EF9', 'EM1', 'EM2', 'EM3'
] as const;
export const anoEscolarSchema = z.enum(ANOS_ESCOLARES);
export type AnoEscolar = z.infer<typeof anoEscolarSchema>;

export const SENHA_MIN = 8;
export const SENHA_MAX = 128;

export const apelidoSchema = z.string().min(5).max(32).regex(/^[A-Za-z]+[0-9]{2,3}$/);
export const nascimentoSchema = z
  .string()
  .regex(/^(19|20)[0-9]{2}-(0[1-9]|1[0-2])$/)
  .refine(v => v <= new Date().toISOString().slice(0, 7), 'nascimento no futuro');
/** Entrada: normaliza (trim + minúsculas) antes de validar. */
export const emailEntradaSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
/** Saída: já normalizado. */
export const emailSchema = z.email().max(254);
export const senhaSchema = z.string().min(SENHA_MIN).max(SENHA_MAX);
export const turnstileTokenSchema = z.string().max(2048);

export const avisoSchema = z.object({ versao: z.string(), publicadoEm: dataHoraUtcSchema });
export type Aviso = z.infer<typeof avisoSchema>;
export const avisoAceiteSchema = z.object({ versao: z.string().max(64) }).strict();
export type AvisoAceite = z.infer<typeof avisoAceiteSchema>;

export const avisosVigentesSchema = z.object({
  aluno: avisoSchema,
  responsavel: avisoSchema,
  professor: avisoSchema
});
export type AvisosVigentes = z.infer<typeof avisosVigentesSchema>;

// ---------- Requisições ----------
export const tokenRequestSchema = z.object({ token: tokenSchema }).strict();
export type TokenRequest = z.infer<typeof tokenRequestSchema>;

export const cadastroAlunoRequestSchema = z
  .object({
    /** Vem de `sortearApelido`; não existe apelido digitado (DC-03). */
    apelidoToken: tokenSchema,
    nascimento: nascimentoSchema,
    anoEscolar: anoEscolarSchema,
    /** Do responsável se o aluno for menor de 18; do próprio aluno se maior (DC-04). */
    email: emailEntradaSchema,
    senha: senhaSchema,
    aviso: avisoAceiteSchema,
    turnstileToken: turnstileTokenSchema.optional()
  })
  .strict();
export type CadastroAlunoRequest = z.infer<typeof cadastroAlunoRequestSchema>;

export const corrigirEmailRequestSchema = z.object({ email: emailEntradaSchema }).strict();
export type CorrigirEmailRequest = z.infer<typeof corrigirEmailRequestSchema>;

export const concessaoRequestSchema = z
  .object({
    token: tokenSchema,
    nomeResponsavel: z.string().min(2).max(120),
    declaracao: z.literal(true),
    aviso: avisoAceiteSchema,
    rankingAutorizado: z.boolean().default(false)
  })
  .strict();
export type ConcessaoRequest = z.input<typeof concessaoRequestSchema>;

export const rankingConsentimentoRequestSchema = z
  .object({ token: tokenSchema, rankingAutorizado: z.boolean() })
  .strict();
export type RankingConsentimentoRequest = z.infer<typeof rankingConsentimentoRequestSchema>;

export const loginRequestSchema = z
  .object({
    identificador: z.string().min(3).max(254),
    senha: z.string().min(1).max(SENHA_MAX),
    turnstileToken: turnstileTokenSchema.optional()
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const papelAtivoRequestSchema = z.object({ papel: papelSchema }).strict();
export type PapelAtivoRequest = z.infer<typeof papelAtivoRequestSchema>;

export const recuperacaoRequestSchema = z
  .object({ identificador: z.string().min(3).max(254), turnstileToken: turnstileTokenSchema.optional() })
  .strict();
export type RecuperacaoRequest = z.infer<typeof recuperacaoRequestSchema>;

export const novaSenhaRequestSchema = z.object({ token: tokenSchema, novaSenha: senhaSchema }).strict();
export type NovaSenhaRequest = z.infer<typeof novaSenhaRequestSchema>;

export const cadastroProfessorRequestSchema = z
  .object({ token: tokenSchema, nome: z.string().min(2).max(120), senha: senhaSchema, aviso: avisoAceiteSchema })
  .strict();
export type CadastroProfessorRequest = z.infer<typeof cadastroProfessorRequestSchema>;

// ---------- Respostas (data) ----------
export const pendenciaSchema = z.object({
  tipo: z.enum(['responsavel', 'email']),
  emailMascarado: emailMascaradoSchema,
  expiraEm: dataHoraUtcSchema,
  proximoReenvioEm: dataHoraUtcSchema
});
export type Pendencia = z.infer<typeof pendenciaSchema>;

export const escolaSchema = z.object({ id: ulidSchema, nome: z.string() });
export type Escola = z.infer<typeof escolaSchema>;

export const meSchema = z.object({
  id: ulidSchema,
  status: statusContaSchema,
  escopoSessao: z.enum(['completa', 'pendente']),
  apelido: apelidoSchema.nullable(),
  nome: z.string().nullable(),
  email: emailSchema.nullable(),
  papeis: z.array(papelSchema),
  papelAtivo: papelSchema.nullable(),
  anoEscolar: anoEscolarSchema.nullable(),
  escola: escolaSchema.nullable(),
  pendencia: pendenciaSchema.nullable()
});
export type Me = z.infer<typeof meSchema>;

export const apelidoSugeridoSchema = z.object({
  apelido: apelidoSchema,
  apelidoToken: tokenSchema,
  expiraEm: dataHoraUtcSchema
});
export type ApelidoSugerido = z.infer<typeof apelidoSugeridoSchema>;

export const cadastroAlunoResultadoSchema = z.object({
  usuario: z.object({ id: ulidSchema, apelido: apelidoSchema }),
  status: z.enum(['pendente_responsavel', 'pendente_email']),
  menor: z.boolean(),
  pendencia: pendenciaSchema
});
export type CadastroAlunoResultado = z.infer<typeof cadastroAlunoResultadoSchema>;

export const cadastroProfessorResultadoSchema = z.object({
  usuario: z.object({ id: ulidSchema, nome: z.string() }),
  status: z.literal('pendente_email'),
  pendencia: pendenciaSchema
});
export type CadastroProfessorResultado = z.infer<typeof cadastroProfessorResultadoSchema>;

export const confirmacaoEmailResultadoSchema = z.object({ status: z.literal('ativa') });
export type ConfirmacaoEmailResultado = z.infer<typeof confirmacaoEmailResultadoSchema>;

export const pedidoConsentimentoSchema = z.object({
  apelido: apelidoSchema,
  aviso: avisoSchema,
  rankingDisponivel: z.boolean(),
  expiraEm: dataHoraUtcSchema
});
export type PedidoConsentimento = z.infer<typeof pedidoConsentimentoSchema>;

export const consentimentoRegistradoSchema = z.object({
  resultado: z.enum(['autorizado', 'revogado']),
  protocolo: ulidSchema,
  apelido: apelidoSchema,
  registradoEm: dataHoraUtcSchema,
  exclusaoPrevistaAte: dataHoraUtcSchema.optional()
});
export type ConsentimentoRegistrado = z.infer<typeof consentimentoRegistradoSchema>;

export const recusaResultadoSchema = z.object({ resultado: z.literal('recusado') });
export type RecusaResultado = z.infer<typeof recusaResultadoSchema>;

export const gestaoConsentimentoSchema = z.object({
  apelido: apelidoSchema,
  situacao: z.enum(['autorizada', 'revogada']),
  autorizadoEm: dataHoraUtcSchema,
  rankingAutorizado: z.boolean(),
  rankingDisponivel: z.boolean(),
  exclusaoPrevistaAte: dataHoraUtcSchema.nullable()
});
export type GestaoConsentimento = z.infer<typeof gestaoConsentimentoSchema>;

export const loginResultadoSchema = z.object({
  status: statusContaSchema,
  escopoSessao: z.enum(['completa', 'pendente', 'nenhuma']),
  me: meSchema.nullable()
});
export type LoginResultado = z.infer<typeof loginResultadoSchema>;

export const consultaRecuperacaoSchema = z.object({
  apelido: apelidoSchema.nullable(),
  expiraEm: dataHoraUtcSchema
});
export type ConsultaRecuperacao = z.infer<typeof consultaRecuperacaoSchema>;

export const novaSenhaResultadoSchema = z.object({ senhaAlterada: z.literal(true) });
export type NovaSenhaResultado = z.infer<typeof novaSenhaResultadoSchema>;

export const conviteProfessorSchema = z.object({
  email: emailSchema,
  escola: escolaSchema,
  aviso: avisoSchema,
  expiraEm: dataHoraUtcSchema
});
export type ConviteProfessor = z.infer<typeof conviteProfessorSchema>;

// ---------- Registro de operações (para mocks MSW, cliente HTTP e testes de contrato) ----------
export type Acesso = 'publico' | 'token-link' | 'sessao-pendente' | 'sessao-completa';

interface Operacao {
  readonly metodo: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Relativo a `/api/v1`. */
  readonly caminho: string;
  readonly acesso: Acesso;
  readonly sucesso: 200 | 201 | 202;
  /** `Idempotency-Key` obrigatório (DC-09). */
  readonly idempotente: boolean;
  readonly corpo?: z.ZodType;
  /** Schema completo da resposta de sucesso (envelope + data). */
  readonly resposta: z.ZodType;
}

export const OPERACOES_AUTH = {
  obterAvisosVigentes: { metodo: 'GET', caminho: '/avisos-privacidade/vigentes', acesso: 'publico', sucesso: 200, idempotente: false, resposta: okSchema(avisosVigentesSchema) },
  sortearApelido: { metodo: 'GET', caminho: '/cadastro/apelido-sugerido', acesso: 'publico', sucesso: 200, idempotente: false, resposta: okSchema(apelidoSugeridoSchema) },
  cadastrarAluno: { metodo: 'POST', caminho: '/cadastro/aluno', acesso: 'publico', sucesso: 201, idempotente: true, corpo: cadastroAlunoRequestSchema, resposta: okSchema(cadastroAlunoResultadoSchema) },
  reenviarPendencia: { metodo: 'POST', caminho: '/cadastro/pendencia/reenvio', acesso: 'sessao-pendente', sucesso: 202, idempotente: false, resposta: okSchema(pendenciaSchema) },
  corrigirEmailPendencia: { metodo: 'PUT', caminho: '/cadastro/pendencia/email', acesso: 'sessao-pendente', sucesso: 200, idempotente: false, corpo: corrigirEmailRequestSchema, resposta: okSchema(pendenciaSchema) },
  confirmarEmail: { metodo: 'POST', caminho: '/email/confirmacao', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(confirmacaoEmailResultadoSchema) },
  consultarPedidoConsentimento: { metodo: 'POST', caminho: '/consentimentos/consulta', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(pedidoConsentimentoSchema) },
  concederConsentimento: { metodo: 'POST', caminho: '/consentimentos/concessao', acesso: 'token-link', sucesso: 200, idempotente: true, corpo: concessaoRequestSchema, resposta: okSchema(consentimentoRegistradoSchema) },
  recusarConsentimento: { metodo: 'POST', caminho: '/consentimentos/recusa', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(recusaResultadoSchema) },
  consultarGestaoConsentimento: { metodo: 'POST', caminho: '/consentimentos/gestao/consulta', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(gestaoConsentimentoSchema) },
  definirRankingConsentimento: { metodo: 'PUT', caminho: '/consentimentos/gestao/ranking', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: rankingConsentimentoRequestSchema, resposta: okSchema(gestaoConsentimentoSchema) },
  revogarConsentimento: { metodo: 'POST', caminho: '/consentimentos/gestao/revogacao', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(consentimentoRegistradoSchema) },
  solicitarNovoLinkGestao: { metodo: 'POST', caminho: '/consentimentos/gestao/novo-link', acesso: 'token-link', sucesso: 202, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(vazioSchema) },
  entrar: { metodo: 'POST', caminho: '/sessoes', acesso: 'publico', sucesso: 200, idempotente: false, corpo: loginRequestSchema, resposta: okSchema(loginResultadoSchema) },
  sair: { metodo: 'DELETE', caminho: '/sessoes/atual', acesso: 'sessao-pendente', sucesso: 200, idempotente: false, resposta: okSchema(vazioSchema) },
  escolherPapel: { metodo: 'PUT', caminho: '/sessoes/atual/papel-ativo', acesso: 'sessao-completa', sucesso: 200, idempotente: false, corpo: papelAtivoRequestSchema, resposta: okSchema(meSchema) },
  obterMe: { metodo: 'GET', caminho: '/me', acesso: 'sessao-pendente', sucesso: 200, idempotente: false, resposta: okSchema(meSchema) },
  solicitarRecuperacao: { metodo: 'POST', caminho: '/recuperacao', acesso: 'publico', sucesso: 202, idempotente: false, corpo: recuperacaoRequestSchema, resposta: okSchema(vazioSchema) },
  consultarRecuperacao: { metodo: 'POST', caminho: '/recuperacao/consulta', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(consultaRecuperacaoSchema) },
  definirNovaSenha: { metodo: 'POST', caminho: '/recuperacao/nova-senha', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: novaSenhaRequestSchema, resposta: okSchema(novaSenhaResultadoSchema) },
  consultarConviteProfessor: { metodo: 'POST', caminho: '/professores/convites/consulta', acesso: 'token-link', sucesso: 200, idempotente: false, corpo: tokenRequestSchema, resposta: okSchema(conviteProfessorSchema) },
  cadastrarProfessor: { metodo: 'POST', caminho: '/professores', acesso: 'token-link', sucesso: 201, idempotente: true, corpo: cadastroProfessorRequestSchema, resposta: okSchema(cadastroProfessorResultadoSchema) }
} as const satisfies Record<string, Operacao>;

export type OperacaoAuth = keyof typeof OPERACOES_AUTH;
