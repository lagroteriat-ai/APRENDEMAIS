import type { Limitador } from './limitador';

/** Bindings do Worker da API. Fonte: apps/api/wrangler.toml (+ secrets via `wrangler secret`). */
export interface Env {
  ENVIRONMENT: 'dev' | 'staging' | 'production';
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  /** Durable Object de contadores atômicos (rate limit). */
  LIMITADOR: DurableObjectNamespace<Limitador>;
  /** Origens extras (separadas por vírgula) aceitas em POST/PUT/DELETE; a mesma origem sempre vale. */
  ALLOWED_ORIGINS: string;
  /** Base dos links de e-mail (rotas da SPA). */
  APP_BASE_URL: string;
  /** `"true"`: cadastro e recuperação exigem Turnstile. */
  TURNSTILE_OBRIGATORIO: string;
  /** Secret: chave do Turnstile (formulários públicos). */
  TURNSTILE_SECRET: string;
  /** Secret: chave do HMAC-SHA256 do IP em `consentimentos.ip_hash` e nos contadores (PEN-028). */
  IP_HASH_SECRET: string;
  /** Secret: chave do HMAC do `apelidoToken` (≥32 caracteres). */
  APP_SECRET: string;
  /** Só testes: reduzem o custo do Argon2id (padrão: m=19456 KiB, t=2, p=1). */
  ARGON2_M_KIB?: string;
  ARGON2_T?: string;
  /** Só testes: não agenda o alarme de limpeza do Limitador (o relógio dos testes é fixo). */
  SEM_ALARME_LIMITADOR?: string;
}
