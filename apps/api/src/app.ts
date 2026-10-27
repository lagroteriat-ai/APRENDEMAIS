import { OPERACOES_AUTH, type OperacaoAuth } from '@aprendemais/shared-types';
import { Hono, type MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import { exigeAcesso, type Acesso } from './acesso';
import { criarDepsPadrao } from './deps';
import { ProvedorEmailFake } from './email/provedor';
import type { Env } from './env';
import { chaveOpaca } from './limite';
import { ErroApp, ok, registrarErro, respostaErro, validacao } from './lib/http';
import { ulid } from './lib/ids';
import { validarComSchema } from './lib/validacao';
import { cadastrarAluno, confirmarEmail, corrigirEmailPendencia, obterAvisosVigentes, reenviarPendencia, sortearApelido } from './rotas/cadastro';
import {
  concederConsentimento, consultarGestaoConsentimento, consultarPedidoConsentimento, definirRankingConsentimento,
  recusarConsentimento, revogarConsentimento, solicitarNovoLinkGestao
} from './rotas/consentimento';
import { cadastrarProfessor, consultarConviteProfessor } from './rotas/professores';
import { consultarRecuperacao, definirNovaSenha, solicitarRecuperacao } from './rotas/recuperacao';
import { entrar, escolherPapel, obterMe, sair } from './rotas/sessoes';
import type { AppEnv, Ctx, Deps } from './tipos';

type Handler = (c: Ctx) => Promise<Response>;

/** Um handler por operação do contrato: o TypeScript recusa operação sem handler (e handler sem operação). */
const HANDLERS: Record<OperacaoAuth, Handler> = {
  obterAvisosVigentes,
  sortearApelido,
  cadastrarAluno,
  reenviarPendencia,
  corrigirEmailPendencia,
  confirmarEmail,
  consultarPedidoConsentimento,
  concederConsentimento,
  recusarConsentimento,
  consultarGestaoConsentimento,
  definirRankingConsentimento,
  revogarConsentimento,
  solicitarNovoLinkGestao,
  entrar,
  sair,
  escolherPapel,
  obterMe,
  solicitarRecuperacao,
  consultarRecuperacao,
  definirNovaSenha,
  consultarConviteProfessor,
  cadastrarProfessor
};

/** Exceções ao `acesso` do contrato: `sair` é idempotente e responde 200 mesmo sem sessão (auth.yaml). */
const ACESSO_EFETIVO: Partial<Record<OperacaoAuth, Acesso>> = { sair: 'publico' };

const METODOS_QUE_ALTERAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF (SR-04): `Origin`, se presente, tem que ser a própria origem ou estar em ALLOWED_ORIGINS; corpo só `application/json`. */
const csrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (METODOS_QUE_ALTERAM.has(c.req.method)) {
    const origem = c.req.header('Origin');
    if (origem) {
      const permitidas = c.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
      if (origem !== new URL(c.req.url).origin && !permitidas.includes(origem)) throw new ErroApp('FORBIDDEN');
    }
    if (c.req.raw.body !== null && !/^application\/json\s*(;.*)?$/i.test(c.req.header('Content-Type') ?? '')) {
      throw new ErroApp('FORBIDDEN');
    }
  }
  await next();
};

function lerCorpo(schema: z.ZodType): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const texto = await c.req.text();
    c.set('corpoBruto', texto);
    let bruto: unknown = {};
    if (texto.trim()) {
      try {
        bruto = JSON.parse(texto);
      } catch {
        throw validacao([]);
      }
    }
    c.set('corpo', validarComSchema(schema, bruto));
    await next();
  };
}

export function criarApp(overrides: Partial<Deps> = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('deps', { ...criarDepsPadrao(c.env), ...overrides });
    c.set('requestId', ulid());
    const ip = c.req.header('CF-Connecting-IP') ?? null;
    c.set('ip', ip);
    c.set('ipHash', await chaveOpaca(c.env, ip ?? 'sem-ip'));
    c.set('corpoBruto', '');
    c.set('corpo', undefined);
    c.set('sessao', null);
    c.set('sessaoCarregada', false);
    await next();
    // toda resposta: id da requisição, nada em cache (SR-19), sem sniffing
    c.res.headers.set('X-Request-Id', c.var.requestId);
    c.res.headers.set('Cache-Control', 'no-store');
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
  });

  const api = new Hono<AppEnv>();
  api.use('*', csrf);
  for (const id of Object.keys(OPERACOES_AUTH) as OperacaoAuth[]) {
    const op = OPERACOES_AUTH[id];
    const mw: MiddlewareHandler<AppEnv>[] = [exigeAcesso(ACESSO_EFETIVO[id] ?? op.acesso)];
    if ('corpo' in op) mw.push(lerCorpo(op.corpo));
    const cadeia = [...mw, HANDLERS[id]] as unknown as [MiddlewareHandler<AppEnv>, ...MiddlewareHandler<AppEnv>[]];
    api.on(op.metodo, op.caminho, ...cadeia);
  }

  // Ferramenta de desenvolvimento (fora do contrato): lê a "caixa de saída" de e-mails. Só existe com ENVIRONMENT=dev.
  api.get('/dev/outbox', async c => {
    if (c.env.ENVIRONMENT !== 'dev') throw new ErroApp('NOT_FOUND');
    // PEN-056/F-06: mesmo em dev, só loopback (a Cloudflare sempre injeta CF-Connecting-IP com o IP real do cliente)
    if (c.var.ip && !['127.0.0.1', '::1'].includes(c.var.ip)) throw new ErroApp('NOT_FOUND');
    return ok(await new ProvedorEmailFake(c.env.KV).listar(c.req.query('para')));
  });

  app.route('/api/v1', api);

  app.notFound(() => respostaErro(new ErroApp('NOT_FOUND')));
  app.onError((erro, c) => {
    if (erro instanceof ErroApp) return respostaErro(erro);
    registrarErro('erro_interno', c.var.requestId ?? 'sem-id', erro);
    return respostaErro(new ErroApp('INTERNAL'));
  });
  return app;
}

export type { Env };
