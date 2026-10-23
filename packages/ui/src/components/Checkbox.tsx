import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx, joinIds } from '../internal/cx';
import { Icon } from '../internal/icons';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Texto do rótulo (clicável). Pode conter links. */
  label: ReactNode;
  help?: ReactNode;
  /** Mensagem de erro (texto + ícone). Presente = inválido. */
  error?: ReactNode;
}

/** Caixa de seleção com rótulo, ajuda e erro próprios. Área clicável ≥ 44px. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, help, error, id, className, 'aria-describedby': descritoPor, ...resto },
  ref,
) {
  const gerado = useId();
  const campoId = id ?? gerado;
  const ajudaId = help ? `${campoId}-ajuda` : undefined;
  const erroId = error ? `${campoId}-erro` : undefined;

  return (
    <div className={cx('am-checkbox', className)}>
      <div className="am-checkbox__row">
        <input
          ref={ref}
          type="checkbox"
          id={campoId}
          className="am-checkbox__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={joinIds(ajudaId, erroId, descritoPor)}
          {...resto}
        />
        <label htmlFor={campoId} className="am-checkbox__label">
          {label}
        </label>
      </div>
      {help && (
        <p id={ajudaId} className="am-checkbox__help">
          {help}
        </p>
      )}
      {error && (
        <p id={erroId} className="am-checkbox__error">
          <Icon name="error" small />
          <span>
            <span className="am-sr-only">Erro:</span> {error}
          </span>
        </p>
      )}
    </div>
  );
});
