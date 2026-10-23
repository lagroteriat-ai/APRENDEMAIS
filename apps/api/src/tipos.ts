import type { Context } from 'hono';
import type { Env } from './env';
import type { SessaoAtiva } from './sessao';

/** E-mail transacional (conteúdo final: PED-02). `link` é o único lugar onde o token em claro sai do servidor. */
export interface MensagemEmail {
  para: string;
  tipo: 'E1' | 'E2' | 'E3' | 'E4' | 'E6';
  assunto: string;
  texto: string;
  link: string;
}

/** Dependências externas e relógio, injetáveis nos testes. */
export interface Deps {
  agora(): Date;
  enviarEmail(mensagem: MensagemEmail): Promise<void>;
  verificarTurnstile(token: string, ip: string | null): Promise<boolean>;
}

export interface Variaveis {
  deps: Deps;
  requestId: string;
  ip: string | null;
  ipHash: string;
  /** Corpo como veio (para o hash de idempotência). */
  corpoBruto: string;
  /** Corpo já validado pelo schema da operação. */
  corpo: unknown;
  sessao: SessaoAtiva | null;
  sessaoCarregada: boolean;
}

export type AppEnv = { Bindings: Env; Variables: Variaveis };
export type Ctx = Context<AppEnv>;
