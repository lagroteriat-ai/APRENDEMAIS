import { createElement, useId, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Elemento HTML. Use `section`/`article` quando houver `title`; `li` dentro de lista. */
  as?: 'div' | 'section' | 'article' | 'li';
  /** Título do cartão (vira um cabeçalho). */
  title?: ReactNode;
  /** Nível do cabeçalho do título; escolha conforme a hierarquia da página. */
  headingLevel?: 2 | 3 | 4;
  /** `tint` destaca o cartão (item selecionado/informativo). */
  tone?: 'default' | 'tint';
  /** Rodapé (ações do cartão). */
  footer?: ReactNode;
}

/** Cartão de conteúdo. Com `title` em `section`/`article`, o título nomeia a região. */
export function Card({
  as = 'div',
  title,
  headingLevel = 2,
  tone = 'default',
  footer,
  className,
  children,
  ...resto
}: CardProps) {
  const tituloId = useId();
  const nomeado = title && (as === 'section' || as === 'article');
  return createElement(
    as,
    {
      className: cx('am-card', tone === 'tint' && 'am-card--tint', className),
      'aria-labelledby': nomeado ? tituloId : undefined,
      ...resto,
    },
    title ? createElement(`h${headingLevel}`, { id: tituloId, className: 'am-card__title' }, title) : null,
    children,
    footer ? <div className="am-card__footer">{footer}</div> : null,
  );
}
