import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, vi } from 'vitest';
import { INSTANTE_FIXO, reiniciarFabricas } from '@aprendemais/test-utils';

// Estado limpo a cada teste: `reset()` apaga D1, KV, R2 e os Durable Objects; depois reaplicamos o schema do DAD (db/migrations).
beforeEach(async () => {
  vi.setSystemTime(new Date(INSTANTE_FIXO)); // testes que "viajam no tempo" não vazam para o próximo
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

// Relógio e fábricas determinísticos em todo teste. Quem precisar de tempo real chama `vi.useRealTimers()`.
vi.useFakeTimers({ now: new Date(INSTANTE_FIXO), toFake: ['Date'] });

afterEach(() => {
  reiniciarFabricas();
});
