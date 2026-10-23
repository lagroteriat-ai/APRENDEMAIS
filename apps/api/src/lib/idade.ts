import { IDADE_MAIORIDADE } from '../config';

function paraMeses(ym: string): number {
  const [a, m] = ym.split('-');
  return Number(a) * 12 + (Number(m) - 1);
}

/**
 * Só temos mês/ano de nascimento (RQ-02). Maior de idade só depois do mês em que completa 18 anos;
 * dentro desse mês a idade é ambígua e tratamos como menor (COORD, DU-07).
 */
export function ehMenor(nascimentoYm: string, agora: Date): boolean {
  const atual = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
  return atual <= paraMeses(nascimentoYm) + IDADE_MAIORIDADE * 12;
}

/** Nascimento plausível: não futuro e com no máximo 110 anos. */
export function nascimentoPlausivel(nascimentoYm: string, agora: Date): boolean {
  const atual = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
  const n = paraMeses(nascimentoYm);
  return n <= atual && atual - n <= 110 * 12;
}
