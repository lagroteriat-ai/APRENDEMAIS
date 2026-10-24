import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { esperarSemViolacoesAxe, expect, test as testBase } from '../base';
import { LOCAL, ORIGEM_WEB_LOCAL, REMOTO } from './constantes';

export { esperarSemViolacoesAxe, expect };

const octeto = () => Math.floor(Math.random() * 254) + 1;
/** IP sintético (faixa 198.18.0.0/15, reservada a testes de rede) para isolar os limites por IP de cada teste. */
export const ipAleatorio = (): string => `198.18.${octeto()}.${octeto()}`;

interface Fixtures {
  /** IP deste teste, enviado em `CF-Connecting-IP` (a API o lê para rate limit). Local: respeitado; Cloudflare real: sobrescrito. */
  ip: string;
  /** Cliente da API sem cookies compartilhados com o navegador do teste (outro "dispositivo", outro IP). */
  novoCliente: () => Promise<Api>;
  /** Cliente da API que compartilha cookies e IP com o navegador do teste. */
  api: Api;
}

export const test = testBase.extend<Fixtures>({
  ip: async ({}, usar) => usar(ipAleatorio()), // eslint-disable-line no-empty-pattern
  extraHTTPHeaders: async ({ ip }, usar) => usar({ 'cf-connecting-ip': ip }),
  api: async ({ request }, usar) => usar(new Api(request)),
  novoCliente: async ({}, usar) => { // eslint-disable-line no-empty-pattern
    const abertos: APIRequestContext[] = [];
    await usar(async () => {
      const ctx = await playwrightRequest.newContext({
        baseURL: REMOTO ?? ORIGEM_WEB_LOCAL,
        extraHTTPHeaders: { 'cf-connecting-ip': ipAleatorio() }
      });
      abertos.push(ctx);
      return new Api(ctx);
    });
    await Promise.all(abertos.map((c) => c.dispose()));
  }
});

/** Pula o teste fora do ambiente local (precisa de banco, IP forjado ou caixa de saída que só o ambiente `dev` expõe). */
export function soLocal(motivo: string) {
  test.skip(!LOCAL, `só local: ${motivo}`);
}

export interface RespostaApi {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corpo: any;
  headers: Record<string, string>;
  /** Todos os `Set-Cookie` (a lista `headers` junta valores repetidos). */
  cookies: string[];
}

interface OpcoesApi {
  corpo?: unknown;
  /** Corpo cru (JSON inválido ou outro Content-Type). */
  bruto?: string;
  headers?: Record<string, string>;
  /** `false` = sem `Idempotency-Key`. */
  chave?: string | false;
}

function lerCorpo(texto: string): unknown {
  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    return texto;
  }
}

/** Cliente fino do contrato `/api/v1` (apps/api/openapi/auth.yaml). */
export class Api {
  constructor(readonly ctx: APIRequestContext) {}

  async chamar(metodo: string, caminho: string, o: OpcoesApi = {}): Promise<RespostaApi> {
    const headers: Record<string, string> = { ...o.headers };
    const temCorpo = o.corpo !== undefined || o.bruto !== undefined;
    if (temCorpo && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
    if (o.chave !== false) headers['idempotency-key'] ??= o.chave ?? crypto.randomUUID();
    const r = await this.ctx.fetch(`/api/v1${caminho}`, {
      method: metodo,
      headers,
      data: o.bruto ?? (o.corpo !== undefined ? JSON.stringify(o.corpo) : undefined),
      failOnStatusCode: false,
      maxRedirects: 0
    });
    const texto = await r.text();
    return {
      status: r.status(),
      corpo: lerCorpo(texto),
      headers: r.headers(),
      cookies: r.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value)
    };
  }

  get = (caminho: string, o?: OpcoesApi) => this.chamar('GET', caminho, o);
  post = (caminho: string, corpo?: unknown, o?: OpcoesApi) => this.chamar('POST', caminho, { ...o, corpo });
  put = (caminho: string, corpo?: unknown, o?: OpcoesApi) => this.chamar('PUT', caminho, { ...o, corpo });
  del = (caminho: string, o?: OpcoesApi) => this.chamar('DELETE', caminho, o);

  /** Valor do cookie `__Host-sid` que este cliente guarda agora (ou `undefined` sem sessão). */
  async cookieDeSessao(): Promise<string | undefined> {
    const { cookies } = await this.ctx.storageState();
    return cookies.find((c) => c.name === '__Host-sid')?.value;
  }
}
