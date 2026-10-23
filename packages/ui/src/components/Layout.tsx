import {
  createElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '../internal/cx';

/** Passos da escala de espaçamento (`--am-space-scale-N`, base 4px). */
export type EspacoPasso = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

function folga(passo: EspacoPasso | undefined): CSSProperties | undefined {
  return passo === undefined
    ? undefined
    : ({ '--am-gap': `var(--am-space-scale-${passo})` } as CSSProperties);
}

/* ---------- Container ---------- */
export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  /** `default` até 1380px · `content` até 1100px · `form` coluna de formulário (440px). */
  size?: 'default' | 'content' | 'form';
  as?: 'div' | 'section' | 'main' | 'header' | 'footer' | 'nav';
}

/** Centraliza o conteúdo, com margem lateral de 16px (mobile) ou 24px (≥ 768px). */
export function Container({ size = 'default', as = 'div', className, ...resto }: ContainerProps) {
  return createElement(as, {
    className: cx('am-container', size !== 'default' && `am-container--${size}`, className),
    ...resto,
  });
}

/* ---------- Stack ---------- */
export interface StackProps extends HTMLAttributes<HTMLElement> {
  /** Espaço entre filhos (passo da escala). Padrão: 4 (16px). */
  gap?: EspacoPasso;
  /** `row` coloca em linha e quebra para a linha de baixo quando falta espaço. */
  direction?: 'column' | 'row';
  as?: 'div' | 'ul' | 'ol' | 'section' | 'form';
}

/** Empilha filhos com espaçamento uniforme. */
export function Stack({ gap, direction = 'column', as = 'div', className, style, ...resto }: StackProps) {
  return createElement(as, {
    className: cx('am-stack', direction === 'row' && 'am-stack--row', className),
    style: { ...folga(gap), ...style },
    ...resto,
  });
}

/* ---------- Grid ---------- */
export interface GridProps extends HTMLAttributes<HTMLElement> {
  /**
   * Máximo de colunas: 1 sempre 1 · 2 = 1 coluna no celular, 2 a partir de 768px ·
   * 3 = 1, depois 2 (≥ 768px), depois 3 (≥ 1024px).
   */
  columns?: 1 | 2 | 3;
  gap?: EspacoPasso;
  as?: 'div' | 'ul' | 'ol' | 'section';
}

/** Grade de cartões mobile-first. */
export function Grid({ columns = 3, gap, as = 'div', className, style, ...resto }: GridProps) {
  return createElement(as, {
    className: cx('am-grid', className),
    'data-columns': columns,
    style: { ...folga(gap), ...style },
    ...resto,
  });
}

/* ---------- AppShell ---------- */
export type Etapa = 'fund1' | 'fund2' | 'medio' | 'neutra';

export interface AppShellProps {
  /** Conteúdo do `<header>` (logo, menu). Omitido = sem cabeçalho. */
  header?: ReactNode;
  /** Conteúdo do `<footer>`. */
  footer?: ReactNode;
  /** Etapa de ensino (`data-etapa`): só na área logada do aluno; telas públicas usam `neutra`. */
  etapa?: Etapa;
  /** Id do `<main>` (alvo do link "Ir para o conteúdo"). */
  mainId?: string;
  skipLinkLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Estrutura da página: link de salto, landmarks (`header`, `main`, `footer`) e `data-etapa`.
 * O `<h1>` da tela fica no `children`.
 */
export function AppShell({
  header,
  footer,
  etapa = 'neutra',
  mainId = 'conteudo',
  skipLinkLabel = 'Ir para o conteúdo',
  className,
  children,
}: AppShellProps) {
  return (
    <div className={cx('am-shell', className)} data-etapa={etapa}>
      <a className="am-skip-link" href={`#${mainId}`}>
        {skipLinkLabel}
      </a>
      {header && <header>{header}</header>}
      <main id={mainId} className="am-shell__main" tabIndex={-1}>
        {children}
      </main>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}
