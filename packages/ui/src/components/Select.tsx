import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { resolverCampo, useFieldContext } from '../internal/field-context';
import { Icon } from '../internal/icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Força o estado inválido (dentro de um `FormField`, vem do `error` dele). */
  invalid?: boolean;
  /** Primeira opção, sem valor (ex.: "Selecione"). */
  placeholder?: string;
}

/** Lista de seleção nativa (melhor teclado e leitor de tela, e seletor próprio no celular). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, placeholder, className, children, ...resto },
  ref,
) {
  const ctx = useFieldContext();
  const campo = resolverCampo(ctx, { ...resto, invalid });
  return (
    <div className="am-select">
      <select ref={ref} className={cx('am-input', 'am-select__control', className)} {...resto} {...campo}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <Icon name="chevron-down" className="am-select__icon" />
    </div>
  );
});
