/** Prefixo da API (mesmo host em prod, ADR-002; em dev o Vite faz proxy para o Worker). */
export const API_BASE = '/api/v1';

/**
 * API simulada (MSW) ligada? Vem de `__API_MOCK__`, definido em `vite.config.ts` a partir de
 * `VITE_API_MOCK=true|false` (padrão: true em `vite`/testes, false em `vite build`).
 */
export const mockAtivo: boolean = __API_MOCK__;

export const turnstileSiteKey: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
