import { describe, expect, it } from 'vitest';
import { avaliarSenha, hashSenha, verificarSenha, verificarSenhaFalsa } from './senha';

const BARATO = { ARGON2_M_KIB: '8', ARGON2_T: '1' };

describe('hashSenha / verificarSenha (Argon2id)', () => {
  it('gera hash no formato esperado, com sal único, e verifica a senha certa', async () => {
    const a = await hashSenha('Uma-Senha-Boa-123', BARATO);
    const b = await hashSenha('Uma-Senha-Boa-123', BARATO);
    expect(a).toMatch(/^argon2id\$v=19\$m=8,t=1,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b); // sal diferente
    expect(a).not.toContain('Uma-Senha-Boa');
    expect(await verificarSenha('Uma-Senha-Boa-123', a)).toBe(true);
    expect(await verificarSenha('Uma-Senha-Boa-124', a)).toBe(false);
    expect(await verificarSenha('', a)).toBe(false);
  });

  it('usa o custo recomendado (m=19 MiB, t=2, p=1) quando não há override', async () => {
    const h = await hashSenha('Uma-Senha-Boa-123', {});
    expect(h).toContain('$m=19456,t=2,p=1$');
    expect(await verificarSenha('Uma-Senha-Boa-123', h)).toBe(true);
  });

  it('normaliza Unicode (NFKC): a mesma senha digitada de formas equivalentes confere', async () => {
    const h = await hashSenha('Pão-de-Açúcar-2026', BARATO);
    expect(await verificarSenha('Pão-de-Açúcar-2026', h)).toBe(true);
  });

  it.each([
    ['vazio', ''],
    ['lixo', 'senha-em-texto-puro'],
    ['algoritmo antigo', 'pbkdf2-sha256$600000$c2FsdA$aGFzaA'],
    ['partes a menos', 'argon2id$v=19$m=8,t=1,p=1$c2FsdA'],
    ['parâmetros absurdos (DoS)', 'argon2id$v=19$m=99999999,t=1,p=1$c2FsdGFsdGFsdGFsdGFsdA$aGFzaA'],
    ['paralelismo inesperado', 'argon2id$v=19$m=8,t=1,p=4$c2FsdGFsdGFsdGFsdGFsdA$aGFzaA']
  ])('hash armazenado inválido (%s) nunca confere e não lança', async (_nome, armazenado) => {
    expect(await verificarSenha('qualquer', armazenado)).toBe(false);
  });

  it('verificarSenhaFalsa devolve false', async () => {
    expect(await verificarSenhaFalsa('qualquer', BARATO)).toBe(false);
  });
});

describe('avaliarSenha (DU-05, SR-10)', () => {
  it('aceita senha longa e incomum', () => {
    expect(avaliarSenha('bola-nuvem-sete', 'LeaoAzul42')).toBeNull();
    expect(avaliarSenha('Senha-de-Teste-123')).toBeNull();
  });

  it.each(['password1', 'PASSWORD1', '12345678', 'qwertyuiop', 'senha123', 'aaaaaaaa', 'abc 12345'.replace(' ', '')])(
    'bloqueia senha comum ou repetitiva: %s',
    senha => {
      expect(avaliarSenha(senha)).toBe('SENHA_COMUM');
    }
  );

  it('bloqueia senha igual ao apelido (com ou sem separadores e caixa)', () => {
    expect(avaliarSenha('LeaoAzul42', 'LeaoAzul42')).toBe('SENHA_IGUAL_APELIDO');
    expect(avaliarSenha('leaoazul42', 'LeaoAzul42')).toBe('SENHA_IGUAL_APELIDO');
    expect(avaliarSenha('leao-azul-42', 'LeaoAzul42')).toBe('SENHA_IGUAL_APELIDO');
    expect(avaliarSenha('LeaoAzul42!', 'LeaoAzul42')).toBeNull();
  });
});
