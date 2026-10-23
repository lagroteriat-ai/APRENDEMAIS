import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cx } from '../internal/cx';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` = ação principal; `accent` = destaque/recompensa; `danger` = ação destrutiva. */
  variant?: ButtonVariant;
  /** `md` (44px) é o padrão; `sm` (36px) só para telas densas, como a do professor. */
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Durante o envio: mantém o foco, bloqueia novos cliques e anuncia "ocupado". */
  loading?: boolean;
  /** Texto exibido no lugar de `children` enquanto `loading` (ex.: "Entrando…"). */
  loadingText?: string;
}

/** Botão. O `type` padrão é "button"; use `type="submit"` no botão de envio do formulário. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    loadingText,
    type = 'button',
    className,
    onClick,
    children,
    ...resto
  },
  ref,
) {
  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      evento.preventDefault();
      return;
    }
    onClick?.(evento);
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'am-btn',
        variant !== 'primary' && `am-btn--${variant}`,
        size !== 'md' && `am-btn--${size}`,
        fullWidth && 'am-btn--full',
        loading && 'am-btn--loading',
        className,
      )}
      // aria-disabled (e não `disabled`) mantém o botão focável durante o envio.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={aoClicar}
      {...resto}
    >
      {loading && <span className="am-spinner" aria-hidden="true" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});
