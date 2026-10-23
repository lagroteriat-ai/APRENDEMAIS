import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { consultar, registrar, zerar } from './limite';

const T0 = Date.parse('2026-10-22T12:00:00Z');

describe('Limitador (Durable Object de contadores)', () => {
  it('conta eventos na janela e informa quando ela reinicia', async () => {
    const a = await registrar(env, T0, 'teste', 'k1', 60);
    const b = await registrar(env, T0 + 10_000, 'teste', 'k1', 60);
    expect(a).toEqual({ contagem: 1, reiniciaEmSeg: 60 });
    expect(b).toEqual({ contagem: 2, reiniciaEmSeg: 50 });
    expect(await consultar(env, T0 + 20_000, 'teste', 'k1')).toEqual({ contagem: 2, reiniciaEmSeg: 40 });
  });

  it('abre janela nova depois que a anterior vence', async () => {
    await registrar(env, T0, 'teste', 'k2', 60);
    await registrar(env, T0, 'teste', 'k2', 60);
    expect(await consultar(env, T0 + 61_000, 'teste', 'k2')).toEqual({ contagem: 0, reiniciaEmSeg: 0 });
    expect((await registrar(env, T0 + 61_000, 'teste', 'k2', 60)).contagem).toBe(1);
  });

  it('isola chaves e nomes diferentes e permite zerar', async () => {
    await registrar(env, T0, 'a', 'k', 60);
    await registrar(env, T0, 'a', 'k', 60);
    expect((await registrar(env, T0, 'b', 'k', 60)).contagem).toBe(1);
    expect((await registrar(env, T0, 'a', 'outra', 60)).contagem).toBe(1);
    await zerar(env, 'a', 'k');
    expect(await consultar(env, T0, 'a', 'k')).toEqual({ contagem: 0, reiniciaEmSeg: 0 });
  });

  it('alarm() limpa o contador vencido e preserva o que ainda está na janela', async () => {
    const stub = env.LIMITADOR.get(env.LIMITADOR.idFromName('alarme:k'));
    await stub.registrar(60, Date.now());
    await runInDurableObject(stub, async (instancia, estado) => {
      await instancia.alarm();
      expect(await estado.storage.get('j')).toBeDefined(); // janela ainda ativa
      vi.setSystemTime(new Date(Date.now() + 61_000));
      await instancia.alarm();
      expect(await estado.storage.get('j')).toBeUndefined(); // vencida: apagada
    });
  });

  it('é atômico sob concorrência: 50 registros simultâneos contam exatamente 50', async () => {
    const r = await Promise.all(Array.from({ length: 50 }, () => registrar(env, T0, 'conc', 'k', 60)));
    expect(Math.max(...r.map(x => x.contagem))).toBe(50);
    expect(new Set(r.map(x => x.contagem)).size).toBe(50);
  });
});
