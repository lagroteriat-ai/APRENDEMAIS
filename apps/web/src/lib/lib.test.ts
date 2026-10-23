import { describe, expect, it } from 'vitest';
import { errosDeCampo, mensagemCampo, mensagemGeral } from '../api/mensagens';
import type { ErroApi } from '../api/cliente';
import { etapaDe, pareceMenor } from './idade';
import { sugerirSenha } from './senha-sugerida';
import {
  validarAnoEscolar,
  validarEmail,
  validarIdentificador,
  validarNascimento,
  validarNome,
  validarSenhaLogin,
  validarSenhaNova,
} from './validacao';

const erro = (code: ErroApi['code'], details: ErroApi['details'] = []): ErroApi => ({
  ok: false, status: 400, code, message: 'texto cru do servidor (não deve aparecer)', details,
});

describe('validação do cliente (espelha o formato do contrato)', () => {
  it('e-mail: normaliza espaços/caixa e rejeita formato inválido', () => {
    expect(validarEmail('  Maria@Example.Test ')).toBeUndefined();
    expect(validarEmail('maria@')).toBe('Escreva um e-mail válido.');
    expect(validarEmail('')).toBe('Escreva um e-mail válido.');
  });

  it('senha nova: 8 a 128 caracteres; a lista de senhas comuns é só do servidor', () => {
    expect(validarSenhaNova('')).toBe('Escreva sua senha.');
    expect(validarSenhaNova('1234567')).toBe('Use pelo menos 8 caracteres.');
    expect(validarSenhaNova('12345678')).toBeUndefined();
    expect(validarSenhaNova('a'.repeat(129))).toBe('Use no máximo 128 caracteres.');
    expect(validarSenhaNova('', 'novaSenha')).toBe('Escreva a nova senha.');
  });

  it('senha do login: só exige algo digitado (sem regras de criação)', () => {
    expect(validarSenhaLogin('x')).toBeUndefined();
    expect(validarSenhaLogin('')).toBe('Escreva sua senha.');
  });

  it('identificador: 3 a 254 caracteres sem contar espaços nas pontas', () => {
    expect(validarIdentificador('ab')).toBeDefined();
    expect(validarIdentificador('  ab ')).toBeDefined();
    expect(validarIdentificador('LeaoAzul42')).toBeUndefined();
  });

  it('nascimento: precisa de mês e ano válidos e não pode ser no futuro', () => {
    expect(validarNascimento('', '')).toBeDefined();
    expect(validarNascimento('05', '')).toBeDefined();
    expect(validarNascimento('05', '2014')).toBeUndefined();
    expect(validarNascimento('01', String(new Date().getFullYear() + 1))).toBeDefined();
  });

  it('ano escolar e nome', () => {
    expect(validarAnoEscolar('EF5')).toBeUndefined();
    expect(validarAnoEscolar('EF10')).toBeDefined();
    expect(validarAnoEscolar('')).toBeDefined();
    expect(validarNome(' A ')).toBeDefined();
    expect(validarNome('Maria')).toBeUndefined();
  });
});

describe('texto do passo 2 (só UX; o servidor decide a idade)', () => {
  const hoje = new Date('2026-10-22T12:00:00Z');
  it('menor de 18 e o mês em que completa 18 anos contam como menor (dúvida = menor)', () => {
    expect(pareceMenor('05', '2014', hoje)).toBe(true);
    expect(pareceMenor('10', '2008', hoje)).toBe(true); // 18 anos neste mês: ambíguo
    expect(pareceMenor('11', '2008', hoje)).toBe(true);
    expect(pareceMenor('09', '2008', hoje)).toBe(false); // já tem 18 anos completos
    expect(pareceMenor('03', '2000', hoje)).toBe(false);
  });
});

describe('etapa de ensino', () => {
  it('Fund. I (1º–5º), Fund. II (6º–9º), Médio; sem ano = neutra', () => {
    expect(etapaDe('EF1')).toBe('fund1');
    expect(etapaDe('EF5')).toBe('fund1');
    expect(etapaDe('EF6')).toBe('fund2');
    expect(etapaDe('EF9')).toBe('fund2');
    expect(etapaDe('EM3')).toBe('medio');
    expect(etapaDe(null)).toBe('neutra');
  });
});

describe('catálogo de mensagens', () => {
  it('nunca usa o texto cru do servidor', () => {
    for (const code of ['INTERNAL', 'CONTRATO', 'FORBIDDEN', 'RATE_LIMITED', 'REDE', 'TOKEN_INVALIDO'] as const) {
      expect(mensagemGeral(erro(code))).not.toMatch(/texto cru/);
    }
    expect(mensagemGeral(erro('NOT_FOUND'))).toBe(mensagemGeral(erro('FORBIDDEN'))); // 403 = 404 (ADR-001 §3)
  });

  it('mapeia details[].path e code para o campo e guarda só o primeiro erro de cada um', () => {
    const e = erro('VALIDATION_ERROR', [
      { path: 'senha', code: 'SENHA_COMUM' },
      { path: 'senha', code: 'SENHA_CURTA' },
      { path: 'aviso.versao', code: 'AVISO_DESATUALIZADO' },
    ]);
    expect(errosDeCampo(e)).toEqual({
      senha: 'Essa senha é muito comum. Escolha outra.',
      aviso: 'O aviso mudou. Leia de novo e marque para continuar.',
    });
  });

  it('campo ou código desconhecido cai numa mensagem neutra', () => {
    expect(mensagemCampo('campoNovo', 'OBRIGATORIO')).toBe('Confira este campo.');
  });
});

describe('senha sugerida', () => {
  it('são 3 palavras minúsculas ligadas por hífen e varia a cada chamada', () => {
    const amostra = new Set(Array.from({ length: 20 }, () => sugerirSenha()));
    for (const s of amostra) expect(s).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(amostra.size).toBeGreaterThan(10);
  });
});
