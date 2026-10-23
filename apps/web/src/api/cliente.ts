import {
  OPERACOES_AUTH,
  erroRespostaSchema,
  type CampoErro,
  type CodigoErro,
} from '@aprendemais/shared-types';
import { API_BASE } from '../config';

/* Cliente HTTP tipado pelo registro de operações do contrato (`OPERACOES_AUTH`, auth.yaml v1.0).
   Método, caminho, status de sucesso, corpo e resposta vêm do contrato; nada de rota escrita à mão. */

type Operacoes = typeof OPERACOES_AUTH;
export type NomeOperacao = keyof Operacoes;

// Tipos de entrada/saída lidos do "Standard Schema" que o Zod expõe (evita depender do `zod` aqui).
type Entrada<S> = S extends { '~standard': { types?: infer T } }
  ? T extends { input: infer I }
    ? I
    : never
  : never;
type Saida<S> = S extends { '~standard': { types?: infer T } }
  ? T extends { output: infer O }
    ? O
    : never
  : never;

/** Corpo aceito pela operação (`undefined` se ela não tem corpo). */
export type CorpoDe<K extends NomeOperacao> = Operacoes[K] extends { corpo: infer S } ? Entrada<S> : undefined;
/** Conteúdo de `data` na resposta de sucesso. */
export type DadosDe<K extends NomeOperacao> =
  Saida<Operacoes[K]['resposta']> extends { data: infer D } ? D : never;

export interface SucessoApi<T> {
  ok: true;
  status: number;
  data: T;
  requestId?: string;
}

export interface ErroApi {
  ok: false;
  /** 0 quando não houve resposta (rede, tempo esgotado). */
  status: number;
  /** `REDE` = sem resposta; `CONTRATO` = resposta fora do contrato (tratada como erro interno). */
  code: CodigoErro | 'REDE' | 'CONTRATO';
  /** Texto do servidor. A UI mostra o do catálogo (`mensagens.ts`), não este. */
  message: string;
  details: CampoErro[];
  requestId?: string;
  /** Segundos, do cabeçalho `Retry-After` (429). */
  retryAfter?: number;
}

export type ResultadoApi<T> = SucessoApi<T> | ErroApi;

interface Extras {
  /** `Idempotency-Key`. Gerada se omitida; reutilize a mesma ao reenviar o mesmo formulário (DC-09). */
  chave?: string;
}
type Argumentos<K extends NomeOperacao> = CorpoDe<K> extends undefined
  ? [opcoes?: Extras]
  : [opcoes: Extras & { corpo: CorpoDe<K> }];

export interface Cliente {
  chamar<K extends NomeOperacao>(operacao: K, ...args: Argumentos<K>): Promise<ResultadoApi<DadosDe<K>>>;
}

export interface OpcoesCliente {
  base?: string;
  /** Padrão: `fetch` global no momento da chamada (assim o MSW, ligado depois, também intercepta). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function novoUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function erroSemResposta(code: ErroApi['code'], message: string, status = 0, requestId?: string): ErroApi {
  return { ok: false, status, code, message, details: [], requestId };
}

export function criarCliente({ base = API_BASE, fetchImpl, timeoutMs = 20_000 }: OpcoesCliente = {}): Cliente {
  async function chamar(nome: NomeOperacao, opcoes: (Extras & { corpo?: unknown }) | undefined) {
    const operacao: (typeof OPERACOES_AUTH)[NomeOperacao] = OPERACOES_AUTH[nome];
    const url = new URL(`${base}${operacao.caminho}`, globalThis.location.origin);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const corpo = opcoes?.corpo;
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (operacao.idempotente) headers['Idempotency-Key'] = opcoes?.chave ?? novoUuid();

    let resposta: Response;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const envio = (fetchImpl ?? globalThis.fetch)(url, {
        method: operacao.metodo,
        headers,
        credentials: 'same-origin',
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      const limite = new Promise<never>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error('timeout')), timeoutMs);
      });
      resposta = await Promise.race([envio, limite]);
    } catch {
      return erroSemResposta('REDE', 'Sem conexão.');
    } finally {
      clearTimeout(timer);
    }

    const requestId = resposta.headers.get('X-Request-Id') ?? undefined;
    let json: unknown;
    try {
      json = await resposta.json();
    } catch {
      json = undefined;
    }

    if (resposta.ok) {
      const lido = operacao.resposta.safeParse(json);
      if (lido.success) {
        return { ok: true, status: resposta.status, data: (lido.data as { data: unknown }).data, requestId } as const;
      }
      // Sem PII no log: só a operação e os caminhos que divergem do contrato.
      console.error(`[api] resposta fora do contrato em ${nome}`, lido.error.issues.map((i) => i.path.join('.')));
      return erroSemResposta('CONTRATO', 'Resposta inesperada.', resposta.status, requestId);
    }

    const erro = erroRespostaSchema.safeParse(json);
    if (!erro.success) return erroSemResposta('INTERNAL', 'Algo deu errado.', resposta.status, requestId);
    const espera = Number.parseInt(resposta.headers.get('Retry-After') ?? '', 10);
    return {
      ok: false,
      status: resposta.status,
      code: erro.data.error.code,
      message: erro.data.error.message,
      details: erro.data.error.details ?? [],
      requestId,
      retryAfter: Number.isFinite(espera) ? espera : undefined,
    } satisfies ErroApi;
  }

  return {
    chamar: ((nome: NomeOperacao, opcoes?: Extras & { corpo?: unknown }) =>
      chamar(nome, opcoes)) as Cliente['chamar'],
  };
}
