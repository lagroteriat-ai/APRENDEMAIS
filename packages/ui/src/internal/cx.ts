/** Junta nomes de classe ignorando valores falsos. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Junta ids para `aria-describedby`; devolve `undefined` se não houver nenhum. */
export function joinIds(...ids: Array<string | false | null | undefined>): string | undefined {
  const lista = ids.filter(Boolean).join(' ');
  return lista || undefined;
}
