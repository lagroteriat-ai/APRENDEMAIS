import { describe, expect, it } from 'vitest';
import { assinarApelido, gerarApelido, lerApelidoAssinado } from './apelidos';
import { sha256Hex, igualConstante, tokenAleatorio } from './crypto';
import { ehMenor, nascimentoPlausivel } from './idade';
import { ulid } from './ids';
import { mascararEmail } from './mascara';

const SEGREDO = 'segredo-de-teste-0123456789abcdef0123456789';
const em = (iso: string): Date => new Date(iso);

describe('ehMenor (RQ-02, DU-07)', () => {
  it('trata o mês dos 18 anos como menor e só depois como maior', () => {
    const agora = em('2026-10-22T12:00:00Z');
    expect(ehMenor('2014-05', agora)).toBe(true);
    expect(ehMenor('2008-11', agora)).toBe(true); // ainda não fez 18
    expect(ehMenor('2008-10', agora)).toBe(true); // faz 18 neste mês: ambíguo → menor
    expect(ehMenor('2008-09', agora)).toBe(false);
    expect(ehMenor('2000-03', agora)).toBe(false);
  });

  it('vira maior no dia 1º do mês seguinte, em UTC', () => {
    expect(ehMenor('2008-10', em('2026-10-31T23:59:59Z'))).toBe(true);
    expect(ehMenor('2008-10', em('2026-11-01T00:00:00Z'))).toBe(false);
  });

  it('nascimentoPlausivel rejeita futuro e mais de 110 anos', () => {
    const agora = em('2026-10-22T12:00:00Z');
    expect(nascimentoPlausivel('2026-10', agora)).toBe(true);
    expect(nascimentoPlausivel('2026-11', agora)).toBe(false);
    expect(nascimentoPlausivel('1900-01', agora)).toBe(false);
    expect(nascimentoPlausivel('1950-01', agora)).toBe(true);
  });
});

describe('apelidos', () => {
  it('gera apelidos no formato do contrato (Animal+Adjetivo+número, sem acento)', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const a = gerarApelido();
      expect(a).toMatch(/^[A-Za-z]+[0-9]{2,3}$/);
      expect(a.length).toBeGreaterThanOrEqual(5);
      expect(a.length).toBeLessThanOrEqual(32);
      vistos.add(a);
    }
    expect(vistos.size).toBeGreaterThan(150);
  });

  it('o token assinado vale por 30 min e não aceita adulteração', async () => {
    const t0 = Date.parse('2026-10-22T12:00:00Z');
    const { token, expiraEmMs } = await assinarApelido('LeaoAzul42', SEGREDO, t0);
    expect(expiraEmMs).toBe(t0 + 30 * 60 * 1000);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token.length).toBeLessThanOrEqual(128);
    expect(await lerApelidoAssinado(token, SEGREDO, t0 + 29 * 60 * 1000)).toBe('LeaoAzul42');
    expect(await lerApelidoAssinado(token, SEGREDO, t0 + 31 * 60 * 1000)).toBeNull();
    expect(await lerApelidoAssinado(token, 'outro-segredo-0123456789abcdef0123456789', t0)).toBeNull();

    const [corpo, assinatura] = token.split('.') as [string, string];
    const outro = btoa('TigreForte99.9999999999').replace(/=+$/, '');
    expect(await lerApelidoAssinado(`${outro}.${assinatura}`, SEGREDO, t0)).toBeNull();
    expect(await lerApelidoAssinado(`${corpo}.${assinatura}.x`, SEGREDO, t0)).toBeNull();
    expect(await lerApelidoAssinado('sem-ponto', SEGREDO, t0)).toBeNull();
    expect(await lerApelidoAssinado('', SEGREDO, t0)).toBeNull();
  });
});

describe('crypto, ids e máscara', () => {
  it('sha256Hex bate com o vetor conhecido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('tokenAleatorio tem 256 bits em base64url e não repete', () => {
    const a = tokenAleatorio();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenAleatorio()).not.toBe(a);
  });

  it('igualConstante compara valores iguais e diferentes (inclusive de tamanhos distintos)', async () => {
    expect(await igualConstante('abc', 'abc')).toBe(true);
    expect(await igualConstante('abc', 'abd')).toBe(false);
    expect(await igualConstante('abc', 'abcd')).toBe(false);
    expect(await igualConstante('', '')).toBe(true);
  });

  it('ulid tem 26 caracteres Crockford e ordena pelo tempo', () => {
    const a = ulid(1_000_000_000_000);
    const b = ulid(1_000_000_000_001);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a.slice(0, 10) < b.slice(0, 10)).toBe(true);
  });

  it('mascararEmail esconde o resto do endereço', () => {
    expect(mascararEmail('maria@gmail.com')).toBe('ma***@gmail.com');
    expect(mascararEmail('a@x.com')).toBe('a***@x.com');
  });
});
