import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Icon } from '../internal/icons';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
}

const ROTULOS: Record<AlertVariant, string> = {
  info: 'Informação',
  success: 'Sucesso',
  warning: 'Atenção',
  error: 'Erro',
};

/**
 * Mensagem de feedback (ícone + texto, nunca só cor). `error` usa `role="alert"` e
 * `info`/`success`/`warning` usam `role="status"`. Para um resumo de erros de formulário,
 * passe `tabIndex={-1}` e mova o foco para ele com a `ref`.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = 'info', title, className, children, role, ...resto },
  ref,
) {
  return (
    <div
      ref={ref}
      role={role ?? (variant === 'error' ? 'alert' : 'status')}
      className={cx('am-alert', `am-alert--${variant}`, className)}
      {...resto}
    >
      <Icon name={variant} />
      <div className="am-alert__body">
        <span className="am-sr-only">{ROTULOS[variant]}:</span>{' '}
        {title && <p className="am-alert__title">{title}</p>}
        {children}
      </div>
    </div>
  );
});
