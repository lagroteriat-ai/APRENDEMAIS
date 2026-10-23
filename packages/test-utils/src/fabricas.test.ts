import {
  cadastroAlunoRequestSchema,
  loginRequestSchema,
  ulidSchema
} from '@aprendemais/shared-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  achadosDePii,
  criarAleatorio,
  exigirSemPii,
  fabricarAlunoMaior,
  fabricarAlunoMenor,
  fabricarCadastroAluno,
  fabricarEscola,
  fabricarLead,
  fabricarLogin,
  fabricarProfessor,
  fabricarResponsavel,
  fabricarTurma,
  reiniciarFabricas,
  ulidFixo
} from './index';

describe('fábricas de dados sintéticos', () => {
  beforeEach(reiniciarFabricas);

  it('geram ULIDs válidos, determinísticos e distintos', () => {
    expect(ulidSchema.safeParse(ulidFixo(1)).success).toBe(true);
    expect(ulidFixo(7)).toBe(ulidFixo(7));
    expect(ulidFixo(7)).not.toBe(ulidFixo(8));
  });

  it('produzem corpos aceitos pelos schemas de shared-types (contrato)', () => {
    expect(cadastroAlunoRequestSchema.safeParse(fabricarCadastroAluno()).success).toBe(true);
    expect(loginRequestSchema.safeParse(fabricarLogin()).success).toBe(true);
  });

  it('permitem sobrescrever campos sem compartilhar estado', () => {
    const a = fabricarAlunoMenor({ apelido: 'Zeca99' });
    const b = fabricarAlunoMenor();
    expect(a.apelido).toBe('Zeca99');
    expect(b.apelido).not.toBe('Zeca99');
    expect(a.id).not.toBe(b.id);
  });

  it('separam menor e maior de idade e não dão nome/e-mail ao aluno menor', () => {
    const menor = fabricarAlunoMenor();
    expect(menor.nome).toBeUndefined();
    expect(menor.email).toBeUndefined();
    expect(fabricarAlunoMaior().nascimento).not.toBe(menor.nascimento);
  });

  it('só contêm dados sintéticos (sem PII real)', () => {
    const tudo = [
      fabricarAlunoMenor(), fabricarAlunoMaior(), fabricarResponsavel(), fabricarProfessor(),
      fabricarEscola(), fabricarTurma(), fabricarCadastroAluno(), fabricarLead()
    ];
    expect(() => exigirSemPii(tudo)).not.toThrow();
  });

  it('o detector de PII acusa e-mail real e CPF', () => {
    expect(achadosDePii({ email: 'maria@gmail.com' })).toHaveLength(1);
    expect(achadosDePii('123.456.789-09')).toHaveLength(1);
    expect(achadosDePii({ email: 'ana1@example.test' })).toEqual([]);
  });

  it('o PRNG com semente é repetível', () => {
    const [a, b] = [criarAleatorio(42), criarAleatorio(42)];
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
