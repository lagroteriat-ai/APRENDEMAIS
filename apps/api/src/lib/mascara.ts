/** `maria@gmail.com` → `ma***@gmail.com` (T05: nunca mostrar o e-mail inteiro). */
export function mascararEmail(email: string): string {
  const [local = '', dominio = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${dominio}`;
}
