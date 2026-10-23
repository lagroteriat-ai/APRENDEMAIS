/// <reference types="vite/client" />

/** Definido em vite.config.ts (`define`): API simulada (MSW) ligada neste build? */
declare const __API_MOCK__: boolean;

interface ImportMetaEnv {
  /** "true" usa a API simulada (MSW); "false" usa `/api/v1` de verdade. Padrão: true no `vite` (dev), false no build. */
  readonly VITE_API_MOCK?: string;
  /** Chave pública do Cloudflare Turnstile (nunca o segredo). Sem ela, só o modo simulado mostra um desafio de teste. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
