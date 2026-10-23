import type { Me, Papel } from '@aprendemais/shared-types';

/** Rotas da SPA (fluxos.md §1). Tokens de link chegam em `?t=` e são removidos da URL pela página. */
export const ROTAS = {
  entrar: '/entrar',
  cadastro: '/cadastro',
  aguardando: '/cadastro/aguardando',
  autorizar: '/responsavel/autorizar',
  recuperar: '/recuperar',
  novaSenha: '/recuperar/nova',
  confirmarEmail: '/confirmar-email',
  papel: '/papel',
  aluno: '/aluno',
  professor: '/professor',
  emBreve: '/em-breve',
  emExclusao: '/conta-em-exclusao',
  sessaoExpirada: '/sessao-expirada',
} as const;

export function inicioDoPapel(papel: Papel | null): string {
  if (papel === 'aluno') return ROTAS.aluno;
  if (papel === 'professor') return ROTAS.professor;
  return ROTAS.emBreve; // gestor e admin: sem área no Sprint 1 (fluxos.md T16)
}

/** Para onde levar quem acabou de entrar (ou abriu uma rota pública já logado). */
export function destinoDaSessao(me: Me): string {
  if (me.status === 'pendente_responsavel' || me.status === 'pendente_email') return ROTAS.aguardando;
  if (me.status === 'suspensa_exclusao') return ROTAS.emExclusao;
  if (me.papelAtivo) return inicioDoPapel(me.papelAtivo);
  return me.papeis.length > 1 ? ROTAS.papel : inicioDoPapel(me.papeis[0] ?? null);
}
