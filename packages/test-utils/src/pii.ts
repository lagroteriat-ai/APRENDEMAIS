const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

/**
 * Lista motivos pelos quais `valor` (serializado em JSON) parece conter dado pessoal real:
 * e-mail fora de `example.test` ou CPF. Vazio = parece sintético.
 * Serve para testar fixtures e para checar que logs/respostas de erro não vazam PII (RQ-30, RQ-32).
 */
export function achadosDePii(valor: unknown): string[] {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  const achados: string[] = [];
  for (const email of texto.match(EMAIL) ?? []) {
    if (!/@([\w-]+\.)*example\.test$/i.test(email)) achados.push(`e-mail real? ${email}`);
  }
  if (CPF.test(texto)) achados.push('padrão de CPF');
  return achados;
}

/** Lança se `achadosDePii` encontrar algo (use dentro de `expect`/hooks de teste). */
export function exigirSemPii(valor: unknown): void {
  const achados = achadosDePii(valor);
  if (achados.length) throw new Error(`Possível dado pessoal real em dados de teste: ${achados.join('; ')}`);
}
