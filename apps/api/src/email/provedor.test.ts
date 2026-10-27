import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MensagemEmail } from '../tipos';
import { ProvedorEmailFake, ProvedorEmailNaoConfigurado, criarProvedorEmail } from './provedor';

const msg = (para: string): MensagemEmail => ({
  para, tipo: 'E1', assunto: 'Assunto', texto: 'Texto', link: 'https://app.test/responsavel/autorizar?t=abc'
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProvedorEmailFake (dev/teste)', () => {
  it('grava a mensagem na caixa de saída e lista por destinatário, sem diferenciar maiúsculas', async () => {
    const p = new ProvedorEmailFake(env.KV);
    await p.enviar(msg('Pai@example.test'));
    await p.enviar(msg('mae@example.test'));
    expect(await p.listar()).toHaveLength(2);
    expect(await p.listar('pai@EXAMPLE.test')).toEqual([msg('Pai@example.test')]);
    expect(await p.listar('ninguem@example.test')).toEqual([]);
  });
});

describe('ProvedorEmailNaoConfigurado (produção sem provedor)', () => {
  it('não lança e o log não traz destinatário, assunto nem link (RQ-30)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(new ProvedorEmailNaoConfigurado().enviar(msg('pai@example.test'))).resolves.toBeUndefined();
    const log = erro.mock.calls.map(c => c.join(' ')).join('\n');
    expect(JSON.parse(log)).toEqual({ evento: 'email_provedor_nao_configurado', tipo: 'E1' });
  });
});

describe('criarProvedorEmail', () => {
  it('só dev usa o falso; staging, produção e valor ausente/inesperado usam o real (falha fechada, PEN-056)', () => {
    expect(criarProvedorEmail({ ...env, ENVIRONMENT: 'dev' } as typeof env)).toBeInstanceOf(ProvedorEmailFake);
    for (const ambiente of ['staging', 'production', undefined, 'qualquer'] as const) {
      expect(criarProvedorEmail({ ...env, ENVIRONMENT: ambiente } as unknown as typeof env)).toBeInstanceOf(ProvedorEmailNaoConfigurado);
    }
  });
});
