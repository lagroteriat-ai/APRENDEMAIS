import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { resolverCampo, useFieldContext } from '../internal/field-context';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Força o estado inválido (dentro de um `FormField`, vem do `error` dele). */
  invalid?: boolean;
  /** Ação ao lado do campo, ex.: botão "Mostrar" da senha. */
  endAction?: ReactNode;
}

/**
 * Campo de texto. Dentro de um `FormField` herda id, `aria-describedby`, `aria-invalid`
 * e `aria-required`. Use `type`, `inputMode` e `autoComplete` certos para cada dado.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, endAction, className, type = 'text', ...resto },
  ref,
) {
  const ctx = useFieldContext();
  const campo = resolverCampo(ctx, { ...resto, invalid });
  const controle = (
    <input
      ref={ref}
      type={type}
      className={cx('am-input', className)}
      {...resto}
      {...campo}
    />
  );
  if (!endAction) return controle;
  return (
    <div className="am-input-group">
      {controle}
      {endAction}
    </div>
  );
});
