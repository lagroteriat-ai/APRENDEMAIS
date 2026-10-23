import type { AnoEscolar } from '@aprendemais/shared-types';
import type { Etapa } from '@aprendemais/ui';

/**
 * Só para escolher o TEXTO do passo 2 ("Seu responsável" × "Seu e-mail"). Quem decide se a pessoa
 * é menor é o servidor (DC-04, e a resposta traz `menor`). Mesma regra de dúvida do contrato:
 * no mês em que completa 18 anos a conta é tratada como de menor.
 */
export function pareceMenor(mes: string, ano: string, hoje = new Date()): boolean {
  const meses = (hoje.getUTCFullYear() - Number(ano)) * 12 + (hoje.getUTCMonth() + 1 - Number(mes));
  return meses <= 18 * 12;
}

/** Etapa de ensino (`data-etapa` da área logada) a partir do ano escolar. */
export function etapaDe(ano: AnoEscolar | null | undefined): Etapa {
  if (!ano) return 'neutra';
  if (ano.startsWith('EM')) return 'medio';
  return Number(ano.slice(2)) <= 5 ? 'fund1' : 'fund2';
}

export const ROTULO_ANO_ESCOLAR: Record<AnoEscolar, string> = {
  EF1: '1º ano do Fundamental',
  EF2: '2º ano do Fundamental',
  EF3: '3º ano do Fundamental',
  EF4: '4º ano do Fundamental',
  EF5: '5º ano do Fundamental',
  EF6: '6º ano do Fundamental',
  EF7: '7º ano do Fundamental',
  EF8: '8º ano do Fundamental',
  EF9: '9º ano do Fundamental',
  EM1: '1ª série do Médio',
  EM2: '2ª série do Médio',
  EM3: '3ª série do Médio',
};

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
