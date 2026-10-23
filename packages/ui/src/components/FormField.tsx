import { useId, useMemo, type ReactNode } from 'react';
import { FieldContext, type FieldContextValue } from '../internal/field-context';
import { cx, joinIds } from '../internal/cx';
import { Icon } from '../internal/icons';

export interface FormFieldProps {
  /** Rótulo sempre visível (placeholder não substitui rótulo). */
  label: ReactNode;
  /** Ajuda exibida abaixo do campo. */
  help?: ReactNode;
  /** Mensagem de erro (texto + ícone). Presente = campo inválido. */
  error?: ReactNode;
  /** Mostra "obrigatório" em texto e marca o controle com `aria-required`. */
  required?: boolean;
  /** Mostra "opcional" em texto. */
  optional?: boolean;
  /** Id do controle; gerado se omitido. */
  id?: string;
  className?: string;
  /** O controle: `Input`, `Select` (ou qualquer elemento que aceite `id` e `aria-*`). */
  children: ReactNode;
}

/**
 * Rótulo + controle + ajuda + erro, ligados por `htmlFor` e `aria-describedby`.
 * `Input` e `Select` dentro dele herdam id, descrição, `aria-invalid` e `aria-required`.
 */
export function FormField({
  label,
  help,
  error,
  required,
  optional,
  id,
  className,
  children,
}: FormFieldProps) {
  const gerado = useId();
  const campoId = id ?? gerado;
  const ajudaId = help ? `${campoId}-ajuda` : undefined;
  const erroId = error ? `${campoId}-erro` : undefined;

  const valor = useMemo<FieldContextValue>(
    () => ({
      id: campoId,
      describedBy: joinIds(ajudaId, erroId),
      invalid: Boolean(error),
      required: Boolean(required),
    }),
    [campoId, ajudaId, erroId, error, required],
  );

  return (
    <div className={cx('am-field', className)}>
      <label className="am-field__label" htmlFor={campoId}>
        {label}
        {required && <span className="am-field__tag"> (obrigatório)</span>}
        {optional && !required && <span className="am-field__tag"> (opcional)</span>}
      </label>
      <FieldContext.Provider value={valor}>{children}</FieldContext.Provider>
      {help && (
        <p id={ajudaId} className="am-field__help">
          {help}
        </p>
      )}
      {error && (
        <p id={erroId} className="am-field__error">
          <Icon name="error" small />
          <span>
            <span className="am-sr-only">Erro:</span> {error}
          </span>
        </p>
      )}
    </div>
  );
}
