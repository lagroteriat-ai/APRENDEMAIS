import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { NASCIMENTO_MAIOR, NASCIMENTO_MENOR, SENHA_TESTE, emailFicticio } from '@aprendemais/test-utils';
import type { Hono } from 'hono';
import { criarApp } from '../src/app';
import { sha256Hex } from '../src/lib/crypto';
import { ulid } from '../src/lib/ids';
import { hashSenha } from '../src/lib/senha';
import type { AppEnv, Deps, MensagemEmail } from '../src/tipos';

// Helpers dos testes de integração da API: cliente HTTP com "cookie jar", caixa de e-mails falsa e semeadura direta no D1.

export interface Resp {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corpo: any;
  headers: Headers;
}

export interface Opcoes {
  corpo?: unknown;
  /** Corpo cru (para testar JSON inválido ou outro Content-Type). */
  bruto?: string;
  headers?: Record<string, string>;
  semCookie?: boolean;
  /** `false` = não envia `Idempotency-Key` automática. */
  idempotencia?: string | false;
}

let contadorIp = 0;
export const novoIp = (): string => `203.0.113.${(contadorIp++ % 250) + 1}`;

export class Cliente {
  cookie: string | null = null;
  constructor(
    readonly app: Hono<AppEnv>,
    readonly emails: MensagemEmail[],
    public ambiente: typeof env = env,
    public ip: string = novoIp()
  ) {}

  async chamar(metodo: string, caminho: string, o: Opcoes = {}): Promise<Resp> {
    const headers = new Headers({ 'CF-Connecting-IP': this.ip, ...o.headers });
    let body: string | undefined;
    if (o.bruto !== undefined) body = o.bruto;
    else if (o.corpo !== undefined) {
      body = JSON.stringify(o.corpo);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
    if (this.cookie && !o.semCookie) headers.set('Cookie', this.cookie);
    if (o.idempotencia !== false && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', o.idempotencia ?? crypto.randomUUID());
    const ctx = createExecutionContext();
    const res = await this.app.fetch(new Request(`https://api.test/api/v1${caminho}`, { method: metodo, headers, body }), this.ambiente, ctx);
    await waitOnExecutionContext(ctx);
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie) {
      const m = /^__Host-sid=([^;]*)/.exec(setCookie);
      this.cookie = m?.[1] && !/Max-Age=0/i.test(setCookie) ? `__Host-sid=${m[1]}` : null;
    }
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null, headers: res.headers };
  }

  get = (c: string, o?: Opcoes) => this.chamar('GET', c, o);
  post = (c: string, corpo?: unknown, o?: Opcoes) => this.chamar('POST', c, { ...o, corpo });
  put = (c: string, corpo?: unknown, o?: Opcoes) => this.chamar('PUT', c, { ...o, corpo });
  del = (c: string, o?: Opcoes) => this.chamar('DELETE', c, o);

  /** Outro "navegador": mesmo app e caixa de e-mail, sem cookie, IP próprio. */
  novoNavegador(): Cliente {
    return new Cliente(this.app, this.emails, this.ambiente, novoIp());
  }
}

export interface Contexto {
  cliente: Cliente;
  emails: MensagemEmail[];
  /** Resultado do Turnstile falso: `ok` passa, qualquer outro token falha. */
  turnstileChamadas: string[];
}

export function criarContexto(overrides: Partial<Deps> = {}, ambiente: typeof env = env): Contexto {
  const emails: MensagemEmail[] = [];
  const turnstileChamadas: string[] = [];
  const app = criarApp({
    enviarEmail: async m => {
      emails.push(m);
    },
    verificarTurnstile: async token => {
      turnstileChamadas.push(token);
      return token === 'ok';
    },
    ...overrides
  });
  return { cliente: new Cliente(app, emails, ambiente), emails, turnstileChamadas };
}

/** O token em claro vem do link do e-mail (único lugar onde ele existe). */
export function tokenDe(m: MensagemEmail | undefined): string {
  if (!m) throw new Error('e-mail esperado não foi enviado');
  const t = new URL(m.link).searchParams.get('t');
  if (!t) throw new Error('link sem token');
  return t;
}

export const ultimoEmail = (emails: MensagemEmail[], tipo?: MensagemEmail['tipo']): MensagemEmail | undefined =>
  [...emails].reverse().find(m => !tipo || m.tipo === tipo);

export async function sortearApelido(c: Cliente): Promise<{ apelido: string; apelidoToken: string }> {
  const r = await c.get('/cadastro/apelido-sugerido');
  if (r.status !== 200) throw new Error(`sorteio falhou: ${r.status}`);
  return r.corpo.data;
}

export const AVISO_ALUNO = { versao: 'aluno-2026-10-v1' };
export const AVISO_RESPONSAVEL = { versao: 'responsavel-2026-10-v1' };
export const AVISO_PROFESSOR = { versao: 'professor-2026-10-v1' };
export { NASCIMENTO_MAIOR, NASCIMENTO_MENOR, SENHA_TESTE, emailFicticio };

/** Corpo válido de cadastro de aluno (menor por padrão). */
export async function corpoCadastroAluno(c: Cliente, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const { apelidoToken } = await sortearApelido(c);
  return {
    apelidoToken,
    nascimento: NASCIMENTO_MENOR,
    anoEscolar: 'EF5',
    email: emailFicticio('responsavel'),
    senha: SENHA_TESTE,
    aviso: AVISO_ALUNO,
    ...extra
  };
}

export async function cadastrarAluno(c: Cliente, extra: Record<string, unknown> = {}): Promise<{ r: Resp; corpo: Record<string, unknown> }> {
  const corpo = await corpoCadastroAluno(c, extra);
  return { r: await c.post('/cadastro/aluno', corpo), corpo };
}

/** Aluno menor com cadastro feito e autorizado pelo responsável (conta ativa, e-mail do responsável confirmado). */
export async function criarAlunoAutorizado(ctx: Contexto): Promise<{ apelido: string; emailResponsavel: string; tokenGestao: string }> {
  const { r, corpo } = await cadastrarAluno(ctx.cliente);
  const apelido = r.corpo.data.usuario.apelido as string;
  const tokenPedido = tokenDe(ultimoEmail(ctx.emails, 'E1'));
  const concessao = await ctx.cliente.novoNavegador().post('/consentimentos/concessao', {
    token: tokenPedido, nomeResponsavel: 'Maria Fictícia', declaracao: true, aviso: AVISO_RESPONSAVEL
  });
  if (concessao.status !== 200) throw new Error(`concessão falhou: ${concessao.status}`);
  return { apelido, emailResponsavel: corpo.email as string, tokenGestao: tokenDe(ultimoEmail(ctx.emails, 'E2')) };
}

// ---------- semeadura direta no banco ----------

export async function um<T = Record<string, unknown>>(sql: string, ...binds: unknown[]): Promise<T | null> {
  return env.DB.prepare(sql).bind(...binds).first<T>();
}

export async function todos<T = Record<string, unknown>>(sql: string, ...binds: unknown[]): Promise<T[]> {
  return (await env.DB.prepare(sql).bind(...binds).all<T>()).results;
}

export async function contar(tabela: string): Promise<number> {
  return (await um<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`))?.n ?? 0;
}

export interface SemearUsuario {
  papel?: 'aluno' | 'professor' | 'gestor' | 'admin';
  status?: string;
  apelido?: string | null;
  nome?: string | null;
  email?: string | null;
  senha?: string;
  papeisExtras?: string[];
}

/** Cria um usuário já pronto (sem passar pelo cadastro) e devolve o id. */
export async function semearUsuario(o: SemearUsuario = {}): Promise<string> {
  const papel = o.papel ?? 'aluno';
  const id = ulid();
  const aluno = papel === 'aluno';
  await env.DB.prepare(
    `INSERT INTO usuarios (id, papel, status, apelido, nome, email, credencial_hash, nascimento_ym, ano_escolar, exclusao_solicitada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, papel, o.status ?? 'ativa',
    aluno ? (o.apelido ?? `TesteSemeado${Math.floor(Math.random() * 900) + 100}`) : (o.apelido ?? null),
    aluno ? null : (o.nome ?? 'Professora Fictícia'),
    o.email === undefined ? (aluno ? null : emailFicticio('prof')) : o.email,
    await hashSenha(o.senha ?? SENHA_TESTE, env),
    aluno ? NASCIMENTO_MAIOR : null, aluno ? 'EM3' : null,
    o.status === 'suspensa_exclusao' ? new Date().toISOString() : null
  ).run();
  for (const extra of o.papeisExtras ?? []) {
    await env.DB.prepare('INSERT INTO usuario_papeis (usuario_id, papel) VALUES (?, ?)').bind(id, extra).run();
  }
  return id;
}

export async function semearEscola(nome = 'Escola Fictícia'): Promise<string> {
  const municipio = ulid();
  const escola = ulid();
  await env.DB.prepare("INSERT INTO municipios (id, codigo_ibge, nome) VALUES (?, '2611606', 'Recife')").bind(municipio).run();
  await env.DB.prepare('INSERT INTO escolas (id, municipio_id, nome) VALUES (?, ?, ?)').bind(escola, municipio, nome).run();
  return escola;
}

/** Cria um convite e devolve o token em claro (como se viesse do e-mail do convite). */
export async function semearConvite(escolaId: string, email: string, papel: 'professor' | 'gestor' = 'professor', expiraEm?: string): Promise<string> {
  const token = `convite-${crypto.randomUUID()}-${crypto.randomUUID()}`.slice(0, 64);
  await env.DB.prepare('INSERT INTO convites (id, escola_id, email, papel, token_hash, expira_em) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(ulid(), escolaId, email, papel, await sha256Hex(token), expiraEm ?? new Date(Date.now() + 72 * 3600 * 1000).toISOString()).run();
  return token;
}
