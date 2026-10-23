import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { fabricarLead } from '@aprendemais/test-utils';

// Teste de INFRAESTRUTURA (S1-QA-02): prova que o ambiente de teste da API funciona.
// Testes de funcionalidade pertencem a cada dono (BE etc.), no padrão `test/<área>.test.ts`.
describe('infra de testes da API (workerd)', () => {
  it('expõe os bindings declarados no wrangler.toml', async () => {
    await env.KV.put('k', 'v');
    expect(await env.KV.get('k')).toBe('v');
    expect((await env.DB.prepare('select 1 as um').first<{ um: number }>())?.um).toBe(1);
    await env.R2.put('o', 'x');
    expect(await (await env.R2.get('o'))?.text()).toBe('x');
    expect(env.LIMITADOR).toBeDefined();
  });

  it('responde via fetch do Worker real no formato de erro do ADR-001', async () => {
    const resposta = await exports.default.fetch(new Request('https://exemplo.test/api/v1/nao-existe'));
    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('congela o relógio e usa dados sintéticos', () => {
    expect(new Date().toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(fabricarLead().email).toMatch(/@example\.test$/);
  });
});
